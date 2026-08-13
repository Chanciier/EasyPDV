import { Inject, Injectable } from "@nestjs/common";
import { StockItem } from "../../domain/entities/stock-item.entity.js";
import { STOCK_REPOSITORY, type StockRepositoryPort } from "../ports/stock-repository.port.js";

/** Estoque zerado (nunca movimentado) é uma resposta válida — não um erro. */
@Injectable()
export class GetStockUseCase {
  constructor(@Inject(STOCK_REPOSITORY) private readonly stockRepository: StockRepositoryPort) {}

  async execute(warehouseId: string, productId: string): Promise<StockItem> {
    const item = await this.stockRepository.getStockItem(warehouseId, productId);
    return item ?? new StockItem({ warehouseId, productId, quantity: 0, reservedQuantity: 0 });
  }
}
