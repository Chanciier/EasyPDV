import { Inject, Injectable } from "@nestjs/common";
import type { ResolvedPrice } from "@easypdv/shared-types";
import { PRICE_LIST_REPOSITORY, type PriceListRepositoryPort } from "../ports/price-list-repository.port.js";

/**
 * Preços em lote (2026-10-22, PERF-02) — a tela Produtos e o autocomplete da
 * Venda faziam um GET /products/:id/price por linha (100 requisições por
 * página, cada uma com JWT + 2 queries). Aqui são 2 queries para o lote
 * inteiro. Diferente de ResolvePriceUseCase, produto sem preço (ou loja sem
 * lista ativa) não é erro: simplesmente fica fora da resposta — equivale ao
 * 404 individual que o frontend já tratava como "sem preço".
 */
@Injectable()
export class ResolvePricesUseCase {
  constructor(@Inject(PRICE_LIST_REPOSITORY) private readonly priceListRepository: PriceListRepositoryPort) {}

  async execute(productIds: string[]): Promise<ResolvedPrice[]> {
    const uniqueIds = [...new Set(productIds)];
    if (uniqueIds.length === 0) {
      return [];
    }
    const activePriceList = await this.priceListRepository.findActive();
    if (!activePriceList) {
      return [];
    }
    const items = await this.priceListRepository.findItems(activePriceList.id, uniqueIds);
    return items.map((item) => ({
      productId: item.productId,
      price: item.price,
      promotionalPrice: item.promotionalPrice,
      effectivePrice: item.effectivePrice,
    }));
  }
}
