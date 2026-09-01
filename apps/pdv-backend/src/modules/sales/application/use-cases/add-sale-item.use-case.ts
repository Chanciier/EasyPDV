import { Inject, Injectable } from "@nestjs/common";
import type { AddSaleItemInput } from "@easypdv/shared-validation";
import { ResolvePriceUseCase } from "../../../catalog/application/use-cases/resolve-price.use-case.js";
import { SaleNotEditableError, SaleNotFoundError } from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";

/**
 * Lê o preço vigente do Catalog via chamada síncrona (leitura entre módulos é
 * permitida — só grava se torna acoplamento indevido). Ver docs/MODULES.md.
 *
 * **Estoque negativo permitido (2026-09-01, pedido do usuário, "até segunda
 * ordem")**: até aqui havia uma checagem antecipada aqui (early feedback) +
 * um piso no débito atômico em `PrismaSaleRepository.confirm()` (guarda
 * final contra corrida entre dois caixas), ambos bloqueando venda com
 * estoque insuficiente (pedido de 2026-08-19: "não posso ter 5 produtos
 * cadastrados e no fim acabar tendo 6 vendidos"). Uma tentativa anterior de
 * tornar isso um toggle via arquivo de config (`ALLOW_NEGATIVE_STOCK` em
 * `config.env`) não funcionou de forma confiável em campo — removida.
 * Estoque agora vai negativo sem checagem nenhuma (local e no Bling depois
 * do sync); reverter é só recolocar a checagem removida aqui (ver histórico
 * do git) e o piso em `confirm()`.
 */
@Injectable()
export class AddSaleItemUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    private readonly resolvePriceUseCase: ResolvePriceUseCase,
  ) {}

  async execute(saleId: string, input: AddSaleItemInput): Promise<Sale> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new SaleNotFoundError(saleId);
    }
    if (!sale.canBeModified) {
      throw new SaleNotEditableError(saleId);
    }

    const resolvedPrice = await this.resolvePriceUseCase.execute(input.productId);

    // Clube Saldão (2026-09-02) — desconto por item agora, não mais um
    // percentual fixo recalculado sobre a venda inteira (ver
    // ApplyClubDiscountUseCase) — o item novo nasce sem desconto
    // (`discountAmount: 0`), decidido depois via `ApplyItemDiscountUseCase`
    // (frontend escolhe 10%-90%, ou 30% de fallback).
    return this.saleRepository.addItem({
      saleId,
      productId: input.productId,
      quantity: input.quantity,
      unitPrice: resolvedPrice.effectivePrice,
    });
  }
}
