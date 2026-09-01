import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AddSaleItemInput } from "@easypdv/shared-validation";
import { ResolvePriceUseCase } from "../../../catalog/application/use-cases/resolve-price.use-case.js";
import { GetStockUseCase } from "../../../inventory/application/use-cases/get-stock.use-case.js";
import { ListWarehousesUseCase } from "../../../inventory/application/use-cases/list-warehouses.use-case.js";
import { InsufficientStockError, SaleNotEditableError, SaleNotFoundError } from "../../domain/errors.js";
import { computeClubDiscountAmount } from "../../domain/club-discount.constants.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";

/**
 * Lê o preço vigente do Catalog via chamada síncrona (leitura entre módulos é
 * permitida — só grava se torna acoplamento indevido). Ver docs/MODULES.md.
 *
 * **Checagem de estoque** (2026-08-19, pedido do usuário: "não posso ter 5
 * produtos cadastrados e no fim acabar tendo 6 vendidos"): checagem CEDO,
 * pra dar feedback ao operador antes de fechar a venda inteira — não é a
 * garantia final contra corrida entre duas vendas simultâneas do mesmo
 * produto (essa é o decrement atômico com piso em
 * `PrismaSaleRepository.confirm()`, a única escrita real de estoque). Sem
 * depósito cadastrado (`warehouses[0]` ausente), deixa passar — o próprio
 * `ConfirmSaleUseCase` já bloqueia a venda inteira nesse caso com uma
 * mensagem melhor (`NoWarehouseAvailableError`), não faz sentido duplicar
 * aqui.
 *
 * **`ALLOW_NEGATIVE_STOCK`** (2026-08-26, pedido temporário do usuário) —
 * desliga essa checagem (e o piso equivalente em `PrismaSaleRepository.confirm()`)
 * sem remover o código: o estoque pode ir negativo localmente e sincroniza
 * assim mesmo pro Bling, igual qualquer outra baixa. Precisa ser setada em
 * CADA terminal (`.env` é por-instalação, não tem config central pro
 * pdv-backend) — ver docs/CHANGELOG.md pra como desligar depois.
 */
@Injectable()
export class AddSaleItemUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    private readonly resolvePriceUseCase: ResolvePriceUseCase,
    private readonly listWarehousesUseCase: ListWarehousesUseCase,
    private readonly getStockUseCase: GetStockUseCase,
    private readonly configService: ConfigService,
  ) {}

  async execute(saleId: string, input: AddSaleItemInput): Promise<Sale> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new SaleNotFoundError(saleId);
    }
    if (!sale.canBeModified) {
      throw new SaleNotEditableError(saleId);
    }

    const allowNegativeStock = this.configService.get<string>("ALLOW_NEGATIVE_STOCK") === "true";
    const warehouses = await this.listWarehousesUseCase.execute();
    const warehouse = warehouses[0];
    if (warehouse && !allowNegativeStock) {
      const stock = await this.getStockUseCase.execute(warehouse.id, input.productId);
      if (stock.quantity < input.quantity) {
        throw new InsufficientStockError(input.productId, stock.quantity, input.quantity);
      }
    }

    const resolvedPrice = await this.resolvePriceUseCase.execute(input.productId);

    const updated = await this.saleRepository.addItem({
      saleId,
      productId: input.productId,
      quantity: input.quantity,
      unitPrice: resolvedPrice.effectivePrice,
    });

    // Clube Saldão (2026-08-25) — desconto de 30% é sempre um percentual do
    // subtotal ATUAL, não um valor fixo: precisa recalcular a cada item
    // adicionado enquanto o desconto de clube estiver ativo, senão o
    // percentual real vai divergindo dos 30% conforme o carrinho muda. Só
    // recalcula o valor (não reconsulta o Bling/Intermediador de novo — a
    // elegibilidade já foi confirmada quando o desconto foi aplicado).
    if (updated.discountSource === "club") {
      const subtotal = updated.items.reduce((sum, item) => sum + item.totalAmount, 0);
      return this.saleRepository.applyDiscount(updated.id, computeClubDiscountAmount(subtotal), "club");
    }
    return updated;
  }
}
