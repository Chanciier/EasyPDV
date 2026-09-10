import { Inject, Injectable } from "@nestjs/common";
import { onlyDigits } from "@easypdv/shared-validation";
import { STORE_CREDIT_GATEWAY, type StoreCreditGatewayPort } from "../ports/store-credit-gateway.port.js";

/**
 * `GET /store-credit/balance/:document` — lido pelo portão de CPF (venda
 * normal) e pela tela de pagamento (Fase 3), pra mostrar/validar o saldo
 * antes do operador escolher "Vale-Troca". Homônimo do use-case do
 * Intermediador, mas local: aqui só repassa pro STORE_CREDIT_GATEWAY, que já
 * trata "sem identidade de terminal"/rede indisponível como `null` — nunca
 * lança, o chamador decide o que fazer com "não deu pra saber".
 */
@Injectable()
export class GetStoreCreditBalanceUseCase {
  constructor(@Inject(STORE_CREDIT_GATEWAY) private readonly storeCreditGateway: StoreCreditGatewayPort) {}

  async execute(document: string): Promise<number | null> {
    return this.storeCreditGateway.getBalance(onlyDigits(document));
  }
}
