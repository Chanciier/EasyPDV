import { Inject, Injectable } from "@nestjs/common";
import { ListWarehousesUseCase } from "../../../inventory/application/use-cases/list-warehouses.use-case.js";
import {
  InsufficientPaymentError,
  NoWarehouseAvailableError,
  SaleHasNoItemsError,
  SaleNotEditableError,
  SaleNotFoundError,
} from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";

/**
 * Evento central do sistema: confirma a venda e debita o estoque numa única
 * transação atômica local (ver SaleRepositoryPort.confirm e docs/DATABASE.md).
 * Auditoria e sincronização com o Intermediador entram nas Sprints 6/13 —
 * ainda não implementadas.
 */
@Injectable()
export class ConfirmSaleUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    private readonly listWarehousesUseCase: ListWarehousesUseCase,
  ) {}

  async execute(saleId: string): Promise<Sale> {
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

    return this.saleRepository.confirm(saleId, warehouse.id);
  }
}
