import { Injectable } from "@nestjs/common";
import { BlingOAuthClient } from "../../infrastructure/clients/bling-oauth.client.js";

/**
 * `state` carrega só o organizationId (base64url), sem validação
 * criptográfica de CSRF — simplificação V1 aceitável porque esta rota ainda
 * não tem autenticação nenhuma (mesmo risco aberto desde a Sprint 6, ver
 * docs/ERROR-HANDLING.md); hardening real fica pra quando existir auth de
 * verdade nessa API.
 */
@Injectable()
export class ConnectBlingUseCase {
  constructor(private readonly oauthClient: BlingOAuthClient) {}

  execute(organizationId: string): string {
    const state = Buffer.from(organizationId, "utf8").toString("base64url");
    return this.oauthClient.buildAuthorizeUrl(state);
  }
}
