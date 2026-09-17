import { Inject, Injectable } from "@nestjs/common";
import { IsUserActiveSpecification } from "../../domain/specifications/is-user-active.specification.js";
import { InactiveUserError, InvalidCredentialsError } from "../../domain/errors.js";
import type { User } from "../../domain/entities/user.entity.js";
import type { LoginResponseDto } from "../dtos/auth-response.dto.js";
import { toUserResponseDto } from "../dtos/user-response.dto.js";
import { AUTH_SESSION_REPOSITORY, type AuthSessionRepositoryPort } from "../ports/auth-session-repository.port.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";
import { USER_REPOSITORY, type UserRepositoryPort } from "../ports/user-repository.port.js";
import {
  USER_VERIFICATION_GATEWAY,
  type UserVerificationGatewayPort,
} from "../ports/user-verification-gateway.port.js";
import { TokenIssuerService } from "../services/token-issuer.service.js";

export interface LoginCommand {
  email: string;
  password: string;
  terminalId?: string;
}

/**
 * Login único entre terminais (2026-08-21): tenta confirmar a senha no
 * Intermediador PRIMEIRO — só ele é a fonte da verdade da senha, ver
 * `OrgUser` (Postgres). Só cai pro espelho local (SQLite, `User`) quando o
 * Intermediador está genuinamente INALCANÇÁVEL (rede fora, timeout) — nunca
 * quando ele confirma "credenciais inválidas" de propósito (senão uma senha
 * local desatualizada continuaria funcionando mesmo trocada/revogada
 * centralmente). Ver user-verification-gateway.port.ts `CentralLoginResult`.
 */
@Injectable()
export class LoginUseCase {
  private readonly isActive = new IsUserActiveSpecification();

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(AUTH_SESSION_REPOSITORY) private readonly authSessionRepository: AuthSessionRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(USER_VERIFICATION_GATEWAY) private readonly userVerificationGateway: UserVerificationGatewayPort,
    private readonly tokenIssuer: TokenIssuerService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResponseDto> {
    const user = await this.resolveUser(command);

    if (!this.isActive.isSatisfiedBy(user)) {
      throw new InactiveUserError();
    }

    const { accessToken, refreshToken, refreshTokenHash, expiresAt } = await this.tokenIssuer.issue({
      sub: user.id,
      role: user.role,
    });

    const session = await this.authSessionRepository.create({
      userId: user.id,
      refreshTokenHash,
      terminalId: command.terminalId ?? null,
      expiresAt,
    });

    return {
      user: toUserResponseDto(user),
      tokens: {
        accessToken,
        refreshToken: `${session.id}.${refreshToken}`,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  private async resolveUser(command: LoginCommand): Promise<User> {
    const central = await this.userVerificationGateway.verifyLogin(command.email, command.password);

    if (central.status === "invalid") {
      throw new InvalidCredentialsError();
    }

    if (central.status === "verified") {
      // Casa por e-mail (nunca cria linha nova a cada login) e sempre
      // reescreve o hash local com a senha que acabou de ser confirmada
      // central — é esse hash que sustenta o fallback offline depois.
      const freshHash = await this.passwordHasher.hash(command.password);
      return this.userRepository.upsertCentralMirror(central.user.email, {
        name: central.user.name,
        passwordHash: freshHash,
        role: central.user.role,
        active: central.user.active,
        orgUserId: central.user.id,
      });
    }

    // Intermediador inalcançável — cai pro espelho local. Só funciona se essa
    // pessoa já logou neste terminal específico pelo menos uma vez.
    const local = await this.userRepository.findByEmail(command.email);
    if (!local) {
      throw new InvalidCredentialsError();
    }
    const passwordMatches = await this.passwordHasher.compare(command.password, local.passwordHash);
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }
    return local;
  }
}
