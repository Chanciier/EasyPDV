/**
 * Leitura mínima do módulo Fiscal, usada só pelo guarda-corrimão de estorno
 * (VoidConfirmedSaleUseCase). Não importa FiscalModule inteiro de propósito:
 * ProvisioningModule já importa SalesModule (GetTerminalBusyStatusUseCase) e
 * FiscalModule importa ProvisioningModule — importar FiscalModule aqui
 * fecharia um ciclo (Sales -> Fiscal -> Provisioning -> Sales). FiscalDocument
 * vive no mesmo arquivo SQLite que Sale (não é uma fronteira de serviço
 * real), então uma leitura direta implementada dentro do próprio módulo
 * Sales é segura — ver PrismaFiscalStatusReader.
 *
 * F-2 (2026-10-22, UX-11 + SEG-08):
 * - só NFC-e emitida conta (`type === "nfce" && status === "issued"`) —
 *   comprovante não fiscal nunca bloqueia o estorno;
 * - `refreshRemote` consulta a central antes (a NFC-e pode ter sido emitida em
 *   background sem que este terminal saiba) e atualiza o espelho local;
 * - `"unknown"` = a central não respondeu e o espelho local não mostra NFC-e;
 * - `"nfce_pending"` (revisão final) = NFC-e ainda em emissão no Bling — estornar
 *   agora deixaria uma nota autorizada logo depois sem venda por trás.
 */
export type NfceIssuedCheck = "nfce_issued" | "nfce_pending" | "none" | "unknown";

export interface FiscalStatusReaderPort {
  checkIssuedNfce(saleId: string, options: { refreshRemote: boolean }): Promise<NfceIssuedCheck>;
}

export const FISCAL_STATUS_READER = Symbol("FISCAL_STATUS_READER");
