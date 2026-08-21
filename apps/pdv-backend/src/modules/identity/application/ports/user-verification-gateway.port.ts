import type { CreateUserInput } from "@easypdv/shared-validation";
import type { OrgUserPayload, UserRole } from "@easypdv/shared-types";

/**
 * Três estados, não dois — a distinção entre "invalid" e "unreachable"
 * importa de verdade: credenciais recusadas de propósito pelo Intermediador
 * (e-mail/senha errados, ou usuário desativado centralmente) NUNCA devem cair
 * pro espelho local (senão uma senha local desatualizada continuaria
 * funcionando mesmo depois de trocada/revogada centralmente) — só falha de
 * rede/timeout genuína cai pro fallback local. Ver login.use-case.ts.
 */
export type CentralLoginResult =
  | { status: "verified"; user: OrgUserPayload }
  | { status: "invalid" }
  | { status: "unreachable" };

/** Porta — isola o Intermediador do caso de uso. Implementação em infrastructure/gateways. */
export interface UserVerificationGatewayPort {
  verifyLogin(email: string, password: string): Promise<CentralLoginResult>;
  /**
   * `true` só quando o Intermediador CONFIRMA que este e-mail existe
   * centralmente e está desativado — `null` cobre tanto "não é um usuário
   * central" (nunca deve punir um usuário puramente local) quanto "não deu
   * pra confirmar" (rede fora, timeout). Ver refresh-token.use-case.ts.
   */
  checkStillActive(email: string): Promise<boolean | null>;
  /** Usado só no bootstrap (`ensureAdminUser`) — `false` em qualquer caso ambíguo (sem StoreIdentity, rede fora), nunca bloqueia a criação do admin de fallback por engano. */
  hasCentralAdmin(): Promise<boolean>;
  /**
   * Criação/edição de usuário passam a escrever no Intermediador primeiro
   * (sem fila offline — ação rara de admin, ao contrário de venda). Lançam
   * exceção clara em qualquer falha (rede, e-mail já em uso, etc.) — quem
   * chama não tem fallback silencioso aqui.
   */
  createCentralUser(input: CreateUserInput): Promise<OrgUserPayload>;
  updateCentralUserRole(orgUserId: string, role: UserRole): Promise<OrgUserPayload>;
}

export const USER_VERIFICATION_GATEWAY = Symbol("USER_VERIFICATION_GATEWAY");
