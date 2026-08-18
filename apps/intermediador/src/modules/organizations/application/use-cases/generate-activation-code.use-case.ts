import { randomInt } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { GenerateActivationCodeInput } from "@easypdv/shared-validation";
import { OrganizationMismatchError, OrganizationNotFoundError, StoreNotFoundError } from "../../domain/errors.js";
import {
  ACTIVATION_CODE_REPOSITORY,
  type ActivationCodeRepositoryPort,
} from "../ports/activation-code-repository.port.js";
import { ORGANIZATION_REPOSITORY, type OrganizationRepositoryPort } from "../ports/organization-repository.port.js";
import { STORE_REPOSITORY, type StoreRepositoryPort } from "../ports/store-repository.port.js";

// Sem 0/O/1/I/L — evita confusão de quem vai digitar o código manualmente
// numa instalação nova. 8 caracteres desse alfabeto (32 símbolos) dão ~40 bits
// de entropia, suficiente pra um código de vida curta (30min, uso único).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const EXPIRATION_MINUTES = 30;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export interface GenerateActivationCodeResult {
  code: string;
  expiresAt: Date;
  storeId: string;
  storeName: string;
}

@Injectable()
export class GenerateActivationCodeUseCase {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizationRepository: OrganizationRepositoryPort,
    @Inject(STORE_REPOSITORY) private readonly storeRepository: StoreRepositoryPort,
    @Inject(ACTIVATION_CODE_REPOSITORY) private readonly activationCodeRepository: ActivationCodeRepositoryPort,
  ) {}

  async execute(
    organizationId: string,
    input: GenerateActivationCodeInput,
    requestingTerminalOrganizationId: string,
  ): Promise<GenerateActivationCodeResult> {
    if (requestingTerminalOrganizationId !== organizationId) {
      throw new OrganizationMismatchError();
    }

    const organization = await this.organizationRepository.findById(organizationId);
    if (!organization) {
      throw new OrganizationNotFoundError(organizationId);
    }

    // generateActivationCodeSchema.refine garante exatamente um dos dois —
    // já validado pelo ZodValidationPipe antes deste use-case rodar.
    const store = input.storeId
      ? await this.requireExistingStore(input.storeId)
      : await this.storeRepository.create({ organizationId, name: input.storeName! });

    const expiresAt = new Date(Date.now() + EXPIRATION_MINUTES * 60_000);
    const activationCode = await this.activationCodeRepository.create({
      storeId: store.id,
      code: generateCode(),
      expiresAt,
    });

    return { code: activationCode.code, expiresAt, storeId: store.id, storeName: store.name };
  }

  private async requireExistingStore(storeId: string) {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new StoreNotFoundError(storeId);
    }
    return store;
  }
}
