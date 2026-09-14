import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "node:crypto";
import type { AuthTokens, OrgUserPayload } from "@easypdv/shared-types";
import {
  ORG_AUTH_SESSION_REPOSITORY,
  type OrgAuthSessionRepositoryPort,
} from "../ports/org-auth-session-repository.port.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";
import { InvalidOrgUserCredentialsError } from "../../domain/errors.js";
import { VerifyOrgUserLoginUseCase } from "./verify-org-user-login.use-case.js";
import { toOrgUserPayload } from "../mappers/org-user-payload.mapper.js";

export interface OrgLoginResult {
  user: OrgUserPayload;
  tokens: AuthTokens;
}

/**
 * `POST /organizations/:id/auth/login` (Fase 0 do painel administrativo,
 * 2026-09-10) — login DIRETO no Intermediador, sem terminal no meio (o
 * navegador do painel não tem apiKey de terminal). Diferente de
 * `verify-login` (que só confirma credencial pro pdv-backend e não emite
 * sessão nenhuma), este emite accessToken (JWT curto) + refreshToken
 * (opaco, hash guardado, rotacionado a cada refresh) — mesmo padrão do
 * LoginUseCase do pdv-backend, sem a etapa de fallback local: aqui já É a
 * fonte da verdade, não precisa cair pra espelho nenhum.
 *
 * Reaproveita VerifyOrgUserLoginUseCase pro check de credencial (mesma
 * distinção 404 e-mail inexistente / 401 senha errada ou inativo, já
 * corrigida ali) em vez de duplicar a lógica.
 *
 * **Allowlist de e-mail (2026-09-14)** — pedido explícito do usuário: só
 * quem estiver em `ADMIN_PANEL_ALLOWED_EMAILS` (env, lista separada por
 * vírgula) consegue logar no painel, mesmo com credencial válida no
 * `OrgUser`. Checado só aqui, nunca em `verify-login`/`VerifyOrgUserLoginUseCase`
 * — o operador de caixa no terminal continua livre pra logar com a própria
 * conta, essa restrição é só do painel admin. Sem a env configurada, sem
 * restrição extra nenhuma (conveniência de dev local) — produção PRECISA
 * dela configurada.
 */
@Injectable()
export class OrgLoginUseCase {
  constructor(
    private readonly verifyOrgUserLoginUseCase: VerifyOrgUserLoginUseCase,
    @Inject(ORG_AUTH_SESSION_REPOSITORY) private readonly orgAuthSessionRepository: OrgAuthSessionRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(organizationId: string, email: string, password: string): Promise<OrgLoginResult> {
    if (!this.isEmailAllowed(email)) {
      // Mesmo erro genérico de senha errada — não revela que o e-mail existe
      // mas não está na lista (mesma filosofia de InvalidOrgUserCredentialsError,
      // ver VerifyOrgUserLoginUseCase). Checado ANTES de tocar o banco/bcrypt:
      // mais barato e evita até timing de resposta diferente pro caso comum.
      throw new InvalidOrgUserCredentialsError();
    }

    const user = await this.verifyOrgUserLoginUseCase.execute(organizationId, email, password);

    const accessToken = this.jwtService.sign({ sub: user.id, organizationId: user.organizationId, role: user.role });
    const refreshSecret = randomBytes(32).toString("base64url");
    const refreshTokenHash = await this.passwordHasher.hash(refreshSecret);
    const refreshTtlDays = Number(this.configService.get("JWT_REFRESH_EXPIRES_DAYS") ?? 30);
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

    const session = await this.orgAuthSessionRepository.create({
      orgUserId: user.id,
      refreshTokenHash,
      expiresAt,
    });

    return {
      user: toOrgUserPayload(user),
      tokens: {
        accessToken,
        refreshToken: `${session.id}.${refreshSecret}`,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  private isEmailAllowed(email: string): boolean {
    const raw = this.configService.get<string>("ADMIN_PANEL_ALLOWED_EMAILS");
    if (!raw) return true;
    const allowlist = raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return allowlist.includes(email.trim().toLowerCase());
  }
}
