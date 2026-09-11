import { Inject, Injectable } from "@nestjs/common";
import { onlyDigits, type CreateStoreCreditGrantInput } from "@easypdv/shared-validation";
import { GetProductUseCase } from "../../../catalog/application/use-cases/get-product.use-case.js";
import { ResolvePriceUseCase } from "../../../catalog/application/use-cases/resolve-price.use-case.js";
import { ListWarehousesUseCase } from "../../../inventory/application/use-cases/list-warehouses.use-case.js";
import { RegisterStockMovementUseCase } from "../../../inventory/application/use-cases/register-stock-movement.use-case.js";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../../../customers/application/ports/customer-repository.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";
import {
  NoWarehouseAvailableError,
  StoreCreditCustomerDataRequiredError,
  StoreCreditItemDiscountExceedsLineTotalError,
} from "../../domain/errors.js";
import {
  STORE_CREDIT_GATEWAY,
  type StoreCreditGatewayPort,
  type StoreCreditGrantItemInput,
  type StoreCreditGrantResult,
} from "../ports/store-credit-gateway.port.js";

/**
 * Orquestra a geração de crédito de troca (Fase 2, 2026-09-10) — acha ou
 * cria o `Customer` local (nome+telefone obrigatórios se novo, pedido
 * explícito do usuário), resolve produto+preço vigente no servidor pra
 * cada item (nunca confia no que o front manda, mesma desconfiança de
 * AddSaleItemUseCase), chama o Intermediador (fonte de verdade do saldo,
 * ver STORE_CREDIT_GATEWAY) e só então devolve ao estoque local os itens
 * marcados `restock: true`.
 *
 * Ordem deliberada: tudo que é validável localmente (produto existe,
 * desconto não excede a linha, depósito disponível se algum item for
 * restockar) roda ANTES da chamada ao Intermediador — a chamada central é
 * o passo mais difícil de desfazer, então só acontece depois que não há
 * mais nada local que possa falhar e deixar um crédito "órfão" sem a
 * devolução de estoque correspondente.
 */
@Injectable()
export class GrantStoreCreditUseCase {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
    @Inject(STORE_CREDIT_GATEWAY) private readonly storeCreditGateway: StoreCreditGatewayPort,
    private readonly getProductUseCase: GetProductUseCase,
    private readonly resolvePriceUseCase: ResolvePriceUseCase,
    private readonly listWarehousesUseCase: ListWarehousesUseCase,
    private readonly registerStockMovementUseCase: RegisterStockMovementUseCase,
  ) {}

  async execute(input: CreateStoreCreditGrantInput, actorUserId: string | null): Promise<StoreCreditGrantResult> {
    const document = onlyDigits(input.document);

    let customer = await this.customerRepository.findByDocument(document);
    if (!customer) {
      if (!input.customerName || !input.customerPhone) {
        throw new StoreCreditCustomerDataRequiredError();
      }
      customer = await this.customerRepository.create({
        name: input.customerName,
        document,
        phone: input.customerPhone,
        email: null,
      });
    }

    const gatewayItems: StoreCreditGrantItemInput[] = [];
    const restockPlan: { productId: string; quantity: number }[] = [];
    for (const item of input.items) {
      const product = await this.getProductUseCase.execute(item.productId);
      const resolvedPrice = await this.resolvePriceUseCase.execute(item.productId);
      const lineTotal = item.quantity * resolvedPrice.effectivePrice;
      if (item.discountAmount > lineTotal) {
        throw new StoreCreditItemDiscountExceedsLineTotalError(item.productId, item.discountAmount, lineTotal);
      }
      gatewayItems.push({
        productSku: product.sku,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: resolvedPrice.effectivePrice,
        discountAmount: item.discountAmount,
        restock: item.restock,
      });
      if (item.restock) {
        restockPlan.push({ productId: item.productId, quantity: item.quantity });
      }
    }

    // Depósito resolvido ANTES da chamada central — ver docblock da classe.
    let warehouseId: string | null = null;
    if (restockPlan.length > 0) {
      const warehouses = await this.listWarehousesUseCase.execute();
      const warehouse = warehouses[0];
      if (!warehouse) {
        throw new NoWarehouseAvailableError();
      }
      warehouseId = warehouse.id;
    }

    const result = await this.storeCreditGateway.grant({
      document,
      customerName: customer.name,
      // Nunca confia que "sem telefone" só aparece como null/undefined —
      // achado real (2026-09-11): um Customer importado do Bling com
      // telefone vazio chegava aqui como "" (string vazia), e o
      // Intermediador rejeita com 400 (customerPhone exige >=1 caractere
      // quando enviado). Trata string vazia igual a ausente.
      customerPhone: customer.phone?.trim() ? customer.phone : undefined,
      items: gatewayItems,
    });

    if (warehouseId) {
      for (const item of restockPlan) {
        await this.registerStockMovementUseCase.execute(
          { warehouseId, productId: item.productId, type: "devolucao", quantity: item.quantity },
          actorUserId,
        );
      }
    }

    await this.auditLogRepository.record({
      userId: actorUserId,
      action: "store_credit.granted",
      entityType: "customer",
      entityId: customer.id,
      metadata: { grantId: result.grantId, totalAmount: result.totalAmount, itemCount: input.items.length },
    });

    return result;
  }
}
