import { Inject, Injectable } from "@nestjs/common";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type FindSalesParams, type SaleRepositoryPort } from "../ports/sale-repository.port.js";

/** Histórico de vendas (Sprint 9). `finalizedOnly` (F6/K3) esconde rascunhos abandonados. */
@Injectable()
export class ListSalesUseCase {
  constructor(@Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort) {}

  execute(params?: Omit<FindSalesParams, "limit">): Promise<Sale[]> {
    return this.saleRepository.findMany({
      status: params?.status,
      cashSessionId: params?.cashSessionId,
      finalizedOnly: params?.finalizedOnly,
      limit: 100,
    });
  }
}
