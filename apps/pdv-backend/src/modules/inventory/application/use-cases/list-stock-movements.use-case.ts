import { Inject, Injectable } from "@nestjs/common";
import type { StockMovement } from "../../domain/entities/stock-movement.entity.js";
import {
  STOCK_REPOSITORY,
  type ListMovementsFilter,
  type StockRepositoryPort,
} from "../ports/stock-repository.port.js";

@Injectable()
export class ListStockMovementsUseCase {
  constructor(@Inject(STOCK_REPOSITORY) private readonly stockRepository: StockRepositoryPort) {}

  execute(filter: ListMovementsFilter): Promise<StockMovement[]> {
    return this.stockRepository.listMovements(filter);
  }
}
