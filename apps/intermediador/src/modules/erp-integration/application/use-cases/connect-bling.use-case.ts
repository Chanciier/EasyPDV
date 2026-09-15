import { Injectable } from "@nestjs/common";
import { BlingOAuthClient } from "../../infrastructure/clients/bling-oauth.client.js";
import { BlingOAuthStateStore } from "../../infrastructure/services/bling-oauth-state.store.js";

/**
 * Achado C2 da auditoria de segurança (2026-09-14) corrigido: `state` era só
 * `base64url(organizationId)`, sem validação real — qualquer um calculava o
 * próprio sem passar por aqui. Agora é um token opaco de alta entropia
 * (BlingOAuthStateStore), e a rota (`ErpIntegrationController.connect`)
 * passou a exigir `OrgJwtAuthGuard` — só um admin autenticado da própria
 * organização consegue gerar um `state` válido pra ela.
 */
@Injectable()
export class ConnectBlingUseCase {
  constructor(
    private readonly oauthClient: BlingOAuthClient,
    private readonly stateStore: BlingOAuthStateStore,
  ) {}

  execute(organizationId: string): string {
    const state = this.stateStore.create(organizationId);
    return this.oauthClient.buildAuthorizeUrl(state);
  }
}
