import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DEFAULT_INTERMEDIADOR_TIMEOUT_MS, getIntermediadorUrl } from "../../../../common/intermediador-config.js";
import {
  STORE_IDENTITY_REPOSITORY,
  type StoreIdentityRepositoryPort,
} from "../../../provisioning/application/ports/store-identity-repository.port.js";
import { throwDescriptiveHttpError } from "../../../../common/describe-http-error.js";
import type { AddClubMemberInput, ClubGatewayPort, ClubMember } from "../../application/ports/club-gateway.port.js";

/** Mesmo padrão de HttpFiscalGateway — apiKey de terminal lida do StoreIdentity local a cada chamada. */
@Injectable()
export class HttpClubGateway implements ClubGatewayPort {
  private readonly baseUrl: string;

  constructor(
    configService: ConfigService,
    @Inject(STORE_IDENTITY_REPOSITORY) private readonly storeIdentityRepository: StoreIdentityRepositoryPort,
  ) {
    this.baseUrl = getIntermediadorUrl(configService);
  }

  /** `null` = não deu pra saber (rede/identidade indisponível) — chamador (CheckClubStatusUseCase) trata como "não bloquear a venda". */
  async checkStatus(document: string): Promise<boolean | null> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      return null;
    }
    const response = await fetch(`${this.baseUrl}/club/status/${encodeURIComponent(document)}`, {
      headers: { "X-Terminal-Api-Key": identity.apiKey },
      signal: AbortSignal.timeout(DEFAULT_INTERMEDIADOR_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { isMember: boolean };
    return body.isMember;
  }

  async listMembers(): Promise<ClubMember[]> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      throw new Error("Terminal não ativado — sem identidade de loja pra consultar o clube.");
    }
    const response = await fetch(`${this.baseUrl}/club/members`, {
      headers: { "X-Terminal-Api-Key": identity.apiKey },
      signal: AbortSignal.timeout(DEFAULT_INTERMEDIADOR_TIMEOUT_MS),
    });
    if (!response.ok) {
      await throwDescriptiveHttpError(response, "GET /club/members");
    }
    return (await response.json()) as ClubMember[];
  }

  async addMember(input: AddClubMemberInput): Promise<ClubMember> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      throw new Error("Terminal não ativado — sem identidade de loja pra adicionar ao clube.");
    }
    const response = await fetch(`${this.baseUrl}/club/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Terminal-Api-Key": identity.apiKey },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(DEFAULT_INTERMEDIADOR_TIMEOUT_MS),
    });
    if (!response.ok) {
      await throwDescriptiveHttpError(response, "POST /club/members");
    }
    return (await response.json()) as ClubMember;
  }

  async removeMember(document: string): Promise<void> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      throw new Error("Terminal não ativado — sem identidade de loja pra remover do clube.");
    }
    const response = await fetch(`${this.baseUrl}/club/members/${encodeURIComponent(document)}`, {
      method: "DELETE",
      headers: { "X-Terminal-Api-Key": identity.apiKey },
      signal: AbortSignal.timeout(DEFAULT_INTERMEDIADOR_TIMEOUT_MS),
    });
    if (!response.ok) {
      await throwDescriptiveHttpError(response, `DELETE /club/members/${document}`);
    }
  }
}
