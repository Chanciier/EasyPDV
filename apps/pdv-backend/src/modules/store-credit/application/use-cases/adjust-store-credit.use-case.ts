import { Inject, Injectable } from "@nestjs/common";
import { onlyDigits, type AdjustStoreCreditInput } from "@easypdv/shared-validation";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";
import { STORE_CREDIT_GATEWAY, type StoreCreditGatewayPort } from "../ports/store-credit-gateway.port.js";

/**
 * Ajuste manual de saldo (tela Clientes, 2026-09-16, pedido do usuário) —
 * correção administrativa solta, fora do fluxo normal de troca/resgate.
 * `actorUserId` nunca vem do corpo validado pelo frontend — sempre o
 * usuário autenticado de verdade (JWT), mesmo motivo de `AddClubMemberUseCase`
 * gravar `actorUserId` a partir de `@CurrentUser()`, nunca de input externo.
 */
@Injectable()
export class AdjustStoreCreditUseCase {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
    @Inject(STORE_CREDIT_GATEWAY) private readonly storeCreditGateway: StoreCreditGatewayPort,
  ) {}

  async execute(input: AdjustStoreCreditInput, actorUserId: string | null): Promise<{ balance: number }> {
    const document = onlyDigits(input.document);
    const result = await this.storeCreditGateway.adjust({
      document,
      amount: input.amount,
      reason: input.reason,
      actorUserId,
    });

    await this.auditLogRepository.record({
      userId: actorUserId,
      action: "store_credit.adjusted",
      entityType: "customer",
      entityId: document,
      metadata: { amount: input.amount, reason: input.reason, balance: result.balance },
    });

    return result;
  }
}
