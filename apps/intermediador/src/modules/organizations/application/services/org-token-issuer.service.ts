import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "node:crypto";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";

export interface IssuedOrgTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

/**
 * Emissão de access/refresh token pro painel admin, compartilhada entre
 * OrgLoginUseCase e OrgRefreshTokenUseCase — antes duplicada byte-a-byte nos
 * dois (mesmo padrão do TokenIssuerService do pdv-backend).
 */
@Injectable()
export class OrgTokenIssuerService {
  constructor(
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async issue(payload: { sub: string; organizationId: string; role: string }): Promise<IssuedOrgTokens> {
    const accessToken = this.jwtService.sign(payload);
    const refreshSecret = randomBytes(32).toString("base64url");
    const refreshTokenHash = await this.passwordHasher.hash(refreshSecret);
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());

    return { accessToken, refreshToken: refreshSecret, refreshTokenHash, expiresAt };
  }

  private refreshTtlMs(): number {
    const raw = this.configService.get("JWT_REFRESH_EXPIRES_DAYS");
    const days = raw === undefined ? 30 : Number(raw);
    if (!Number.isFinite(days) || days <= 0) {
      throw new Error(
        `JWT_REFRESH_EXPIRES_DAYS inválido: "${String(raw)}" — configure um número de dias positivo.`,
      );
    }
    return days * 24 * 60 * 60 * 1000;
  }
}
