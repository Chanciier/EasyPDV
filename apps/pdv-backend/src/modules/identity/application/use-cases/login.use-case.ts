import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "node:crypto";
import { IsUserActiveSpecification } from "../../domain/specifications/is-user-active.specification.js";
import { InactiveUserError, InvalidCredentialsError } from "../../domain/errors.js";
import type { LoginResponseDto } from "../dtos/auth-response.dto.js";
import { toUserResponseDto } from "../dtos/user-response.dto.js";
import { AUTH_SESSION_REPOSITORY, type AuthSessionRepositoryPort } from "../ports/auth-session-repository.port.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";
import { USER_REPOSITORY, type UserRepositoryPort } from "../ports/user-repository.port.js";

export interface LoginCommand {
  email: string;
  password: string;
  terminalId?: string;
}

@Injectable()
export class LoginUseCase {
  private readonly isActive = new IsUserActiveSpecification();

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(AUTH_SESSION_REPOSITORY) private readonly authSessionRepository: AuthSessionRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResponseDto> {
    const user = await this.userRepository.findByEmail(command.email);
    if (!user) {
      throw new InvalidCredentialsError();
    }
    if (!this.isActive.isSatisfiedBy(user)) {
      throw new InactiveUserError();
    }
    const passwordMatches = await this.passwordHasher.compare(command.password, user.passwordHash);
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const accessToken = this.jwtService.sign({ sub: user.id, role: user.role });
    const refreshSecret = randomBytes(32).toString("base64url");
    const refreshTokenHash = await this.passwordHasher.hash(refreshSecret);
    const refreshTtlDays = Number(this.configService.get("JWT_REFRESH_EXPIRES_DAYS") ?? 30);
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

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
        refreshToken: `${session.id}.${refreshSecret}`,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }
}
