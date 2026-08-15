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
 * Evento central do sistema: confirma a venda, debita o estoque e grava a
 * auditoria numa única transação atômica local (ver SaleRepositoryPort.confirm
 * e docs/DATABASE.md). Sincronização com o Intermediador já sai da mesma
 * transação via SyncOutbox (Sprint 6); realtime (Sprint 13) dispara no
 * controller, fora daqui — broadcast de WebSocket não é uma preocupação de
 * domínio, é efeito de apresentação.
 */
@Injectable()
export class ConfirmSaleUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    private readonly listWarehousesUseCase: ListWarehousesUseCase,
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

    return this.saleRepository.confirm(saleId, warehouse.id, actorUserId);
  }
}
