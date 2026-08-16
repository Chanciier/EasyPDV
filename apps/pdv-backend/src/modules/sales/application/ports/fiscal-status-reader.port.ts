/**
 * Leitura mínima do módulo Fiscal, usada só pelo guarda-corrimão de estorno
 * (VoidConfirmedSaleUseCase). Não importa FiscalModule inteiro de propósito:
 * ProvisioningModule já importa SalesModule (GetTerminalBusyStatusUseCase) e
 * FiscalModule importa ProvisioningModule — importar FiscalModule aqui
 * fecharia um ciclo (Sales -> Fiscal -> Provisioning -> Sales). FiscalDocument
 * vive no mesmo arquivo SQLite que Sale (não é uma fronteira de serviço
 * real), então uma leitura direta implementada dentro do próprio módulo
 * Sales é segura — ver PrismaFiscalStatusReader.
 */
export interface FiscalStatusReaderPort {
  hasIssuedFiscalDocument(saleId: string): Promise<boolean>;
}

export const FISCAL_STATUS_READER = Symbol("FISCAL_STATUS_READER");
