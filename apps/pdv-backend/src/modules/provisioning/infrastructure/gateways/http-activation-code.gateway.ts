import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ActivationCodeResult } from "@easypdv/shared-types";
import {
  STORE_IDENTITY_REPOSITORY,
  type StoreIdentityRepositoryPort,
} from "../../application/ports/store-identity-repository.port.js";
import type { ActivationCodeGatewayPort } from "../../application/ports/activation-code-gateway.port.js";

/**
 * Mesmo padrão de HttpFiscalGateway/HttpSyncGateway — apiKey e organizationId
 * lidos do StoreIdentity local a cada chamada. Chamado só pela rota
 * admin-only POST /provisioning/activation-codes (tela Administração), então
 * `identity` nulo aqui seria um bug (terminal precisa estar ativado e logado
 * pra sequer alcançar essa rota) — lança erro em vez de retornar null/silenciar.
 */
@Injectable()
export class HttpActivationCodeGateway implements ActivationCodeGatewayPort {
  private readonly baseUrl: string;

  constructor(
    configService: ConfigService,
    @Inject(STORE_IDENTITY_REPOSITORY) private readonly storeIdentityRepository: StoreIdentityRepositoryPort,
  ) {
    this.baseUrl = configService.get<string>("INTERMEDIADOR_URL") ?? "http://127.0.0.1:4002";
  }

  async generate(): Promise<ActivationCodeResult> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      throw new Error("Terminal ainda não foi ativado — sem apiKey pra gerar código de ativação");
    }

    const response = await fetch(`${this.baseUrl}/organizations/${identity.organizationId}/activation-codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Terminal-Api-Key": identity.apiKey },
      body: JSON.stringify({ storeId: identity.storeId }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(
        body?.message ?? `Intermediador respondeu ${response.status} para POST /organizations/:id/activation-codes`,
      );
    }
    return (await response.json()) as ActivationCodeResult;
  }
}
