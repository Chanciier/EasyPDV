import { Inject, Injectable, Logger } from "@nestjs/common";
import { toErrorMessage } from "../../../../common/to-error-message.js";
import {
  FiscalStatusUnverifiableError,
  SaleHasIssuedFiscalDocumentError,
  SaleNotFoundError,
  SaleNotVoidableError,
} from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";
import { FISCAL_STATUS_READER, type FiscalStatusReaderPort, type NfceIssuedCheck } from "../ports/fiscal-status-reader.port.js";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepositoryPort,
} from "../../../customers/application/ports/customer-repository.port.js";
import type { Customer } from "../../../customers/domain/entities/customer.entity.js";
import { STORE_CREDIT_GATEWAY, type StoreCreditGatewayPort } from "../../../store-credit/application/ports/store-credit-gateway.port.js";
import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepositoryPort,
} from "../../../audit/application/ports/audit-log-repository.port.js";

export interface StoreCreditRefundOutcome {
  status: "refunded" | "pending";
  amount: number;
}

export interface VoidConfirmedSaleOutcome {
  sale: Sale;
  /** Ausente quando a venda não teve perna `vale_troca` aprovada. */
  storeCreditRefund?: StoreCreditRefundOutcome;
}

/** CPF mascarado para audit log (`***.456.789-**`) — o número inteiro não é necessário para conciliar. */
function maskDocument(document: string | null | undefined): string | null {
  if (!document) return null;
  const digits = document.replace(/\D/g, "");
  if (digits.length !== 11) return "***";
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

/**
 * Estorno de venda confirmada (Sprint 14) — devolve estoque e grava o
 * `sale_void` no outbox (o Bling repõe o estoque lá). Cancelar uma NFC-e já
 * emitida na SEFAZ continua fora de escopo — por isso o guarda-corrimão.
 *
 * Guarda fiscal (2026-10-22, F-2 = UX-11 + SEG-08):
 * - só NFC-e emitida bloqueia; comprovante não fiscal nunca;
 * - venda com cliente: consulta a central antes (a NFC-e pode ter saído em
 *   background, sem este terminal saber). Sem resposta → bloqueia com
 *   mensagem clara, salvo se o cliente comprovadamente não tem CPF (NFC-e só
 *   sai com CPF, decisão deliberada);
 * - venda sem cliente: só o espelho local, sem rede. Limitação conhecida:
 *   NFC-e emitida manualmente em OUTRO terminal para venda sem CPF pode não
 *   estar no espelho deste — o estorno passa (raro).
 * - consulta fiscal e busca do cliente correm em paralelo (pior caso 8 s, não 16).
 *
 * Vale-Troca (2026-10-22, F-4, risco #35): estorno local PRIMEIRO, depois a
 * devolução do saldo na central via `adjust` (+ soma das pernas `vale_troca`
 * aprovadas). Nessa ordem nunca credita em dobro: um segundo estorno falha
 * em `SaleNotVoidable` antes de chegar ao crédito. Falha da central não
 * desfaz nem bloqueia o estorno — vira `storeCreditRefund.status =
 * "pending"` + audit `store_credit.refund_pending`, e a tela orienta o
 * ajuste manual em Clientes.
 */
@Injectable()
export class VoidConfirmedSaleUseCase {
  private readonly logger = new Logger(VoidConfirmedSaleUseCase.name);

  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    @Inject(FISCAL_STATUS_READER) private readonly fiscalStatusReader: FiscalStatusReaderPort,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort,
    @Inject(STORE_CREDIT_GATEWAY) private readonly storeCreditGateway: StoreCreditGatewayPort,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: AuditLogRepositoryPort,
  ) {}

  async execute(saleId: string, actorUserId: string | null, reason: string): Promise<VoidConfirmedSaleOutcome> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new SaleNotFoundError(saleId);
    }
    if (!sale.canBeVoided) {
      throw new SaleNotVoidableError(saleId);
    }

    // `undefined` = não deu pra saber (central fora); `null` = sem cliente.
    const [fiscalCheck, customer] = await Promise.all([
      this.fiscalStatusReader.checkIssuedNfce(saleId, { refreshRemote: sale.customerId !== null }),
      this.resolveCustomer(sale.customerId),
    ]);
    this.assertNoIssuedNfce(saleId, fiscalCheck, customer);

    const voided = await this.saleRepository.voidConfirmed(saleId, actorUserId, reason);

    const valeTrocaTotal =
      Math.round(
        sale.payments
          .filter((p) => p.status === "aprovado" && p.method === "vale_troca")
          .reduce((sum, p) => sum + p.amount, 0) * 100,
      ) / 100;
    if (valeTrocaTotal <= 0) {
      return { sale: voided };
    }

    const storeCreditRefund = await this.refundStoreCredit(saleId, valeTrocaTotal, customer, reason, actorUserId);
    return { sale: voided, storeCreditRefund };
  }

  private async resolveCustomer(customerId: string | null): Promise<Customer | null | undefined> {
    if (!customerId) {
      return null;
    }
    try {
      return await this.customerRepository.findById(customerId);
    } catch (error) {
      this.logger.warn(`Estorno: cliente ${customerId} indisponível na central: ${toErrorMessage(error)}`);
      return undefined;
    }
  }

  private assertNoIssuedNfce(saleId: string, check: NfceIssuedCheck, customer: Customer | null | undefined): void {
    if (check === "nfce_issued") {
      throw new SaleHasIssuedFiscalDocumentError(saleId);
    }
    if (check === "unknown") {
      const customerHasNoDocument = customer !== undefined && !customer?.document;
      if (!customerHasNoDocument) {
        throw new FiscalStatusUnverifiableError();
      }
    }
  }

  private async refundStoreCredit(
    saleId: string,
    amount: number,
    customer: Customer | null | undefined,
    reason: string,
    actorUserId: string | null,
  ): Promise<StoreCreditRefundOutcome> {
    const document = customer?.document ?? null;
    let status: StoreCreditRefundOutcome["status"] = "pending";
    try {
      if (!document) {
        // Venda com Vale-Troca sempre tem CPF (ConfirmSaleUseCase exige) —
        // aqui só chega se a central não respondeu na busca do cliente.
        throw new Error("cliente/CPF indisponível na central");
      }
      await this.storeCreditGateway.adjust({
        document,
        amount,
        reason: `Estorno da venda ${saleId.slice(0, 8)}: ${reason}`,
        actorUserId,
      });
      status = "refunded";
    } catch (error) {
      this.logger.error(`Estorno da venda ${saleId}: Vale-Troca de ${amount} não devolvido: ${toErrorMessage(error)}`);
    }

    // Audit fora do try: uma falha ao gravar a trilha nunca pode transformar
    // um crédito já feito em "pending" (o gerente creditaria de novo à mão).
    try {
      await this.auditLogRepository.record({
        userId: actorUserId,
        action: status === "refunded" ? "store_credit.refunded_on_void" : "store_credit.refund_pending",
        entityType: "sale",
        entityId: saleId,
        metadata: { amount, document: maskDocument(document), customerId: customer?.id ?? null },
      });
    } catch (error) {
      this.logger.error(`Estorno da venda ${saleId}: falha ao gravar auditoria do Vale-Troca: ${toErrorMessage(error)}`);
    }
    return { status, amount };
  }
}
