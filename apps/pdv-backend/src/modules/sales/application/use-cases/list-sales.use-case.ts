import { Inject, Injectable } from "@nestjs/common";
import type { SaleStatus } from "@easypdv/shared-types";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";

/** Histórico de vendas (Sprint 9). */
@Injectable()
export class ListSalesUseCase {
  constructor(@Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort) {}

  execute(params?: { status?: SaleStatus; cashSessionId?: string }): Promise<Sale[]> {
    return this.saleRepository.findMany({ status: params?.status, cashSessionId: params?.cashSessionId, limit: 100 });
  }
}
