import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CreateUserInput } from "@easypdv/shared-validation";
import type { OrgUserPayload, UserRole } from "@easypdv/shared-types";
import {
  STORE_IDENTITY_REPOSITORY,
  type StoreIdentityRepositoryPort,
} from "../../../provisioning/application/ports/store-identity-repository.port.js";
import type { CentralLoginResult, UserVerificationGatewayPort } from "../../application/ports/user-verification-gateway.port.js";
import { EmailAlreadyInUseError } from "../../domain/errors.js";

/**
 * Mesmo padrão de HttpFiscalGateway/HttpSyncGateway — apiKey de terminal lida
 * do StoreIdentity local a cada chamada. Login único entre terminais
 * (2026-08-21): fala com `POST/GET/PATCH /organizations/:id/users*` no
 * Intermediador. Timeouts agressivos de propósito — quem chama sempre tem um
 * fallback local pronto (login/refresh) ou está numa ação de admin rara
 * (criar/editar usuário), nunca vale travar a UI esperando o Intermediador.
 */
@Injectable()
export class HttpUserVerificationGateway implements UserVerificationGatewayPort {
  private readonly logger = new Logger(HttpUserVerificationGateway.name);
  private readonly baseUrl: string;

  constructor(
    configService: ConfigService,
    @Inject(STORE_IDENTITY_REPOSITORY) private readonly storeIdentityRepository: StoreIdentityRepositoryPort,
  ) {
    this.baseUrl = configService.get<string>("INTERMEDIADOR_URL") ?? "http://127.0.0.1:4002";
  }

  async verifyLogin(email: string, password: string): Promise<CentralLoginResult> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      return { status: "unreachable" };
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/organizations/${identity.organizationId}/users/verify-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Terminal-Api-Key": identity.apiKey },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      this.logger.warn(`verify-login: Intermediador inalcançável — ${String(error)}`);
      return { status: "unreachable" };
    }

    if (response.status === 401) {
      return { status: "invalid" };
    }
    if (!response.ok) {
      this.logger.warn(`verify-login: Intermediador respondeu ${response.status}`);
      return { status: "unreachable" };
    }
    const user = (await response.json()) as OrgUserPayload;
    return { status: "verified", user };
  }

  async checkStillActive(email: string): Promise<boolean | null> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      return null;
    }
    try {
      const response = await fetch(`${this.baseUrl}/organizations/${identity.organizationId}/users`, {
        headers: { "X-Terminal-Api-Key": identity.apiKey },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return null;
      }
      const users = (await response.json()) as OrgUserPayload[];
      const match = users.find((u) => u.email === email);
      // Não encontrado centralmente = usuário puramente local, nunca visto
      // pelo Intermediador — não é o mesmo que "desativado", não deve punir.
      return match ? match.active : null;
    } catch (error) {
      this.logger.warn(`checkStillActive: Intermediador inalcançável — ${String(error)}`);
      return null;
    }
  }

  async hasCentralAdmin(): Promise<boolean> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      return false;
    }
    try {
      const response = await fetch(`${this.baseUrl}/organizations/${identity.organizationId}/users`, {
        headers: { "X-Terminal-Api-Key": identity.apiKey },
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) {
        return false;
      }
      const users = (await response.json()) as OrgUserPayload[];
      return users.some((u) => u.role === "administrador" && u.active);
    } catch (error) {
      this.logger.warn(`hasCentralAdmin: Intermediador inalcançável — ${String(error)}`);
      return false;
    }
  }

  async createCentralUser(input: CreateUserInput): Promise<OrgUserPayload> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      throw new Error("Terminal ainda não ativado — não é possível criar usuário sem conexão com o Intermediador");
    }
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/organizations/${identity.organizationId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Terminal-Api-Key": identity.apiKey },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      throw new Error(`Não foi possível conectar ao servidor central para criar o usuário: ${String(error)}`);
    }
    if (response.status === 409) {
      throw new EmailAlreadyInUseError(input.email);
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `Intermediador respondeu ${response.status} ao criar usuário`);
    }
    return (await response.json()) as OrgUserPayload;
  }

  async updateCentralUserRole(orgUserId: string, role: UserRole): Promise<OrgUserPayload> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      throw new Error("Terminal ainda não ativado — não é possível editar usuário sem conexão com o Intermediador");
    }
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/organizations/${identity.organizationId}/users/${orgUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Terminal-Api-Key": identity.apiKey },
        body: JSON.stringify({ role }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      throw new Error(`Não foi possível conectar ao servidor central para editar o usuário: ${String(error)}`);
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `Intermediador respondeu ${response.status} ao editar usuário`);
    }
    return (await response.json()) as OrgUserPayload;
  }

  async changePassword(orgUserId: string, newPassword: string): Promise<void> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      throw new Error("Terminal ainda não ativado — não é possível trocar a senha sem conexão com o Intermediador");
    }
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/organizations/${identity.organizationId}/users/${orgUserId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Terminal-Api-Key": identity.apiKey },
        body: JSON.stringify({ newPassword }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      throw new Error(`Não foi possível conectar ao servidor central para trocar a senha: ${String(error)}`);
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `Intermediador respondeu ${response.status} ao trocar a senha`);
    }
  }
}
