import type { ActivationCode } from "../../domain/entities/activation-code.entity.js";

export interface CreateActivationCodeData {
  storeId: string;
  code: string;
  expiresAt: Date;
}

export interface ActivationCodeRepositoryPort {
  create(data: CreateActivationCodeData): Promise<ActivationCode>;
  findByCode(code: string): Promise<ActivationCode | null>;
  /** UPDATE condicional (WHERE usedAt IS NULL) — evita duas ativações concorrentes com o mesmo código. */
  markUsed(id: string): Promise<boolean>;
}

export const ACTIVATION_CODE_REPOSITORY = Symbol("ACTIVATION_CODE_REPOSITORY");
