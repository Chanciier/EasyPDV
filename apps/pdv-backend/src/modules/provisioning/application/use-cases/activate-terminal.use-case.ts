import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TerminalActivationResult } from "@easypdv/shared-types";
import type { StoreIdentity } from "../../domain/entities/store-identity.entity.js";
import { ActivationFailedError, AlreadyActivatedError } from "../../domain/errors.js";
import {
  STORE_IDENTITY_REPOSITORY,
  type StoreIdentityRepositoryPort,
} from "../ports/store-identity-repository.port.js";
import { SyncProductsFromBlingUseCase } from "../../../catalog/application/use-cases/sync-products-from-bling.use-case.js";

export interface ActivateTerminalCommand {
  code: string;
  terminalName?: string;
}

/**
 * Chama o Intermediador (POST /terminals/activate) pra trocar o código de
 * ativação por uma identidade de terminal + apiKey, e persiste localmente
 * (StoreIdentity, SQLite) — a apiKey em texto puro é o que HttpSyncGateway
 * usa depois pra autenticar POST /sync. Chamado pelo Electron (main process)
 * no primeiro boot sem terminal ativado. Ver docs/ELECTRON.md.
 */
@Injectable()
export class ActivateTerminalUseCase {
  private readonly logger = new Logger(ActivateTerminalUseCase.name);
  private readonly intermediadorUrl: string;

  constructor(
    @Inject(STORE_IDENTITY_REPOSITORY) private readonly storeIdentityRepository: StoreIdentityRepositoryPort,
    private readonly syncProductsFromBlingUseCase: SyncProductsFromBlingUseCase,
    configService: ConfigService,
  ) {
    this.intermediadorUrl = configService.get<string>("INTERMEDIADOR_URL") ?? "http://127.0.0.1:4002";
  }

  async execute(command: ActivateTerminalCommand): Promise<StoreIdentity> {
    const existing = await this.storeIdentityRepository.find();
    if (existing) {
      throw new AlreadyActivatedError();
    }

    let response: Response;
    try {
      response = await fetch(`${this.intermediadorUrl}/terminals/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: command.code, terminalName: command.terminalName }),
      });
    } catch (error) {
      this.logger.error(`fetch para ${this.intermediadorUrl}/terminals/activate falhou: ${String(error)}`);
      throw new ActivationFailedError("não foi possível conectar ao servidor. Verifique sua internet e tente novamente");
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new ActivationFailedError(body?.message ?? `Intermediador respondeu ${response.status}`);
    }

    const result = (await response.json()) as TerminalActivationResult;

    const identity = await this.storeIdentityRepository.create({
      organizationId: result.organizationId,
      storeId: result.storeId,
      storeName: result.storeName,
      terminalId: result.terminalId,
      apiKey: result.apiKey,
    });

    // Fire-and-forget: catálogos grandes (dezenas de milhares de produtos)
    // levam minutos pra buscar do Bling por causa de rate limit — não faz
    // sentido segurar a resposta de ativação esperando isso. Erro (ex:
    // organização sem Bling conectado ainda) é esperado e não deve quebrar a
    // ativação em si, só fica registrado no log. Botão manual "Sincronizar
    // com Bling" na tela Produtos cobre retry/atualização depois.
    void this.syncProductsFromBlingUseCase
      .execute()
      .then((r) => this.logger.log(`Sync automático de catálogo Bling na ativação: ${r.created} novo(s), ${r.updated} atualizado(s), ${r.deactivated} desativado(s) de ${r.total}`))
      .catch((error) => this.logger.error(`Sync automático de catálogo Bling na ativação falhou: ${String(error)}`));

    return identity;
  }
}
