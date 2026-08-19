import { Inject, Injectable } from "@nestjs/common";
import { WAREHOUSE_REPOSITORY, type WarehouseRepositoryPort } from "../ports/warehouse-repository.port.js";
import { STOCK_REPOSITORY, type StockRepositoryPort } from "../ports/stock-repository.port.js";

export interface ProductStockSummary {
  productId: string;
  quantity: number;
}

/**
 * Estoque de todos os produtos do depósito padrão, num tiro só — pra tela
 * Produtos mostrar a coluna "Estoque" sem uma chamada por produto (2026-08-19,
 * pedido do usuário: "eu preciso ter controle do que tenho"). Sem depósito
 * cadastrado, devolve lista vazia — a tela Produtos não deveria travar por
 * causa disso, e `ConfirmSaleUseCase` já tem o guarda-corrimão de verdade
 * pra esse caso (`NoWarehouseAvailableError`).
 */
@Injectable()
export class ListStockUseCase {
  constructor(
    @Inject(WAREHOUSE_REPOSITORY) private readonly warehouseRepository: WarehouseRepositoryPort,
    @Inject(STOCK_REPOSITORY) private readonly stockRepository: StockRepositoryPort,
  ) {}

  async execute(): Promise<ProductStockSummary[]> {
    const warehouses = await this.warehouseRepository.findAll();
    const warehouse = warehouses[0];
    if (!warehouse) {
      return [];
    }
    const items = await this.stockRepository.listByWarehouse(warehouse.id);
    return items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
  }
}
