import { Inject, Injectable } from "@nestjs/common";
import { ListWarehousesUseCase } from "../../../inventory/application/use-cases/list-warehouses.use-case.js";
import {
  InsufficientPaymentError,
  NoWarehouseAvailableError,
  SaleHasNoItemsError,
  SaleNotEditableError,
  SaleNotFoundError,
  StoreCreditRedemptionRequiresCustomerError,
} from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepositoryPort,
} from "../../../customers/application/ports/customer-repository.port.js";
import { STORE_CREDIT_GATEWAY, type StoreCreditGatewayPort } from "../../../store-credit/application/ports/store-credit-gateway.port.js";

/**
 * Evento central do sistema: confirma a venda, debita o estoque e grava a
 * auditoria numa única transação atômica local (ver SaleRepositoryPort.confirm
 * e docs/DATABASE.md). Sincronização com o Intermediador já sai da mesma
 * transação via SyncOutbox (Sprint 6); realtime (Sprint 13) dispara no
 * controller, fora daqui — broadcast de WebSocket não é uma preocupação de
 * domínio, é efeito de apresentação.
 *
 * Vale-Troca (Fase 3, 2026-09-10): se a venda tiver alguma perna paga com
 * `vale_troca`, o débito de verdade contra o saldo central (Intermediador)
 * acontece AQUI, depois de toda checagem local possível (itens, pagamento
 * completo, depósito disponível) e ANTES da confirmação local em si — mesma
 * ordem de GrantStoreCreditUseCase (o que é mais difícil de desfazer roda por
 * último entre os passos que ainda podem falhar por motivo local, e primeiro
 * entre os que sobram). `PrismaStoreCreditRepository.redeem()` já é
 * idempotente por `saleReference` (mesmo id desta venda) — um retry depois de
 * uma falha na confirmação local não debita o saldo duas vezes.
 */
@Injectable()
export class ConfirmSaleUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    private readonly listWarehousesUseCase: ListWarehousesUseCase,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort,
    @Inject(STORE_CREDIT_GATEWAY) private readonly storeCreditGateway: StoreCreditGatewayPort,
  ) {}

  async execute(saleId: string, actorUserId: string | null): Promise<Sale> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new SaleNotFoundError(saleId);
    }
    if (!sale.canBeModified) {
      throw new SaleNotEditableError(saleId);
    }
    if (sale.items.length === 0) {
      throw new SaleHasNoItemsError(saleId);
    }
    if (!sale.isFullyPaid) {
      throw new InsufficientPaymentError(saleId, sale.approvedPaymentsTotal, sale.totalAmount);
    }

    const warehouses = await this.listWarehousesUseCase.execute();
    const warehouse = warehouses[0];
    if (!warehouse) {
      throw new NoWarehouseAvailableError();
    }

    const valeTrocaTotal = sale.payments
      .filter((p) => p.status === "aprovado" && p.method === "vale_troca")
      .reduce((sum, p) => sum + p.amount, 0);
    if (valeTrocaTotal > 0) {
      const customer = sale.customerId ? await this.customerRepository.findById(sale.customerId) : null;
      if (!customer?.document) {
        throw new StoreCreditRedemptionRequiresCustomerError(saleId);
      }
      await this.storeCreditGateway.redeem({
        document: customer.document,
        amount: valeTrocaTotal,
        saleReference: saleId,
      });
    }

    return this.saleRepository.confirm(saleId, warehouse.id, actorUserId);
  }
}
