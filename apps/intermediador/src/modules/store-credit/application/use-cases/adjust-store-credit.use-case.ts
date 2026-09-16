import { Inject, Injectable } from "@nestjs/common";
import type { AdjustStoreCreditInput } from "@easypdv/shared-validation";
import { InsufficientStoreCreditError } from "../../domain/errors.js";
import { STORE_CREDIT_REPOSITORY, type StoreCreditRepositoryPort } from "../ports/store-credit-repository.port.js";

export interface AdjustStoreCreditContext {
  organizationId: string;
  storeId: string | null;
  terminalId: string | null;
  actorUserId: string | null;
}

/**
 * Ajuste manual de saldo (tela Clientes, 2026-09-16) — correção
 * administrativa fora do fluxo normal de troca/resgate. Reaproveita
 * `InsufficientStoreCreditError` quando um ajuste negativo deixaria o saldo
 * abaixo de zero — mesma semântica de negócio de `RedeemStoreCreditUseCase`.
 */
@Injectable()
export class AdjustStoreCreditUseCase {
  constructor(@Inject(STORE_CREDIT_REPOSITORY) private readonly storeCreditRepository: StoreCreditRepositoryPort) {}

  async execute(context: AdjustStoreCreditContext, input: AdjustStoreCreditInput): Promise<{ balance: number }> {
    const result = await this.storeCreditRepository.adjust({
      organizationId: context.organizationId,
      customerCpf: input.document,
      amount: input.amount,
      reason: input.reason,
      actorUserId: context.actorUserId,
      storeId: context.storeId,
      terminalId: context.terminalId,
    });
    if (!result) {
      throw new InsufficientStoreCreditError(input.document);
    }
    return result;
  }
}
