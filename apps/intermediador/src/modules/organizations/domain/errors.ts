import { DomainError } from "../../../common/domain-error.js";

export class OrganizationNotFoundError extends DomainError {
  readonly kind = "not_found";
  constructor(id: string) {
    super(`Organização ${id} não encontrada`);
  }
}

export class StoreNotFoundError extends DomainError {
  readonly kind = "not_found";
  constructor(id: string) {
    super(`Loja ${id} não encontrada`);
  }
}

export class ActivationCodeInvalidError extends DomainError {
  readonly kind = "not_found";
  constructor() {
    super("Código de ativação inválido");
  }
}

export class ActivationCodeExpiredError extends DomainError {
  readonly kind = "conflict";
  constructor() {
    super("Código de ativação expirado");
  }
}

export class ActivationCodeAlreadyUsedError extends DomainError {
  readonly kind = "conflict";
  constructor() {
    super("Código de ativação já foi usado");
  }
}

export class InvalidTerminalApiKeyError extends DomainError {
  readonly kind = "unauthorized";
  constructor() {
    super("Chave de API de terminal inválida");
  }
}

export class OrganizationMismatchError extends DomainError {
  readonly kind = "forbidden";
  constructor() {
    super("Terminal não pertence a esta organização");
  }
}

// Login único entre terminais (2026-08-21) — ver docs/DATABASE.md `OrgUser`.

export class OrgUserEmailAlreadyInUseError extends DomainError {
  readonly kind = "conflict";
  constructor(email: string) {
    super(`Já existe um usuário com o e-mail ${email} nesta organização`);
  }
}

export class OrgUserNotFoundError extends DomainError {
  readonly kind = "not_found";
  constructor(id: string) {
    super(`Usuário ${id} não encontrado`);
  }
}

/**
 * Única mensagem para e-mail inexistente, senha errada OU usuário inativo —
 * de propósito (mitigação de risco planejada: não vazar se o e-mail existe
 * nem por que a tentativa falhou, nem por tempo de resposta diferente entre
 * os casos). Ver Claude/Projetos/EasyPDV/Decisões e Riscos Abertos.md no
 * cofre Obsidian.
 */
export class InvalidOrgUserCredentialsError extends DomainError {
  readonly kind = "unauthorized";
  constructor() {
    super("E-mail ou senha inválidos");
  }
}
