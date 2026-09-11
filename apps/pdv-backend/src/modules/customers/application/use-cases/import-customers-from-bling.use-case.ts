import { Inject, Injectable } from "@nestjs/common";
import {
  CUSTOMER_BLING_IMPORT_GATEWAY,
  type CustomerBlingImportGatewayPort,
  type ImportCustomersFromBlingResult,
} from "../ports/customer-bling-import-gateway.port.js";

/** Botão "Sincronizar com Bling" na tela Clientes — só repassa o gatilho pro Intermediador, que já faz toda a paginação/escrita. */
@Injectable()
export class ImportCustomersFromBlingUseCase {
  constructor(
    @Inject(CUSTOMER_BLING_IMPORT_GATEWAY) private readonly gateway: CustomerBlingImportGatewayPort,
  ) {}

  execute(): Promise<ImportCustomersFromBlingResult> {
    return this.gateway.importFromBling();
  }
}
