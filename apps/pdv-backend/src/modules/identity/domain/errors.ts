import { DomainError, type DomainErrorKind } from "../../../common/domain-error.js";

/** Erros de domínio — mapeados para HTTP genericamente via `kind`. Ver DomainExceptionFilter. */

export class InvalidCredentialsError extends DomainError {
  readonly kind: DomainErrorKind = "unauthorized";
  constructor() {
    super("E-mail ou senha inválidos");
  }
}

export class InactiveUserError extends DomainError {
  readonly kind: DomainErrorKind = "forbidden";
  constructor() {
    super("Usuário inativo");
  }
}

export class InvalidRefreshTokenError extends DomainError {
  readonly kind: DomainErrorKind = "unauthorized";
  constructor() {
    super("Refresh token inválido ou expirado");
  }
}

export class EmailAlreadyInUseError extends DomainError {
  readonly kind: DomainErrorKind = "conflict";
  constructor(email: string) {
    super(`Já existe um usuário com o e-mail ${email}`);
  }
}

export class UserNotFoundError extends DomainError {
  readonly kind: DomainErrorKind = "not_found";
  constructor(id: string) {
    super(`Usuário ${id} não encontrado`);
  }
}
