import { DomainError, type DomainErrorKind } from "../../../common/domain-error.js";

/** Erros de domínio — mapeados para HTTP genericamente via `kind`. Ver DomainExceptionFilter. */

export class InvalidCredentialsError extends DomainError {
  readonly kind: DomainErrorKind = "unauthorized";
  constructor() {
    super("E-mail ou senha inválidos");
  }
}

/** SEG-02 / K9 — o Intermediador respondeu 429 (5 tentativas/min por terminal+e-mail). Sem fallback local. */
export class CentralLoginThrottledError extends DomainError {
  readonly kind: DomainErrorKind = "too_many_requests";
  constructor() {
    super("Muitas tentativas. Aguarde 1 minuto e tente de novo.");
  }
}

/** SEG-02 — limite do login offline (espelho local): 5 falhas em 5 minutos por e-mail neste terminal. */
export class LocalLoginThrottledError extends DomainError {
  readonly kind: DomainErrorKind = "too_many_requests";
  constructor() {
    super("Muitas tentativas de senha neste caixa. Aguarde 5 minutos ou peça a um gerente.");
  }
}

/** SEG-15 — só o proprietário mexe no papel `proprietario`, e ninguém altera o próprio papel. */
export class ForbiddenRoleChangeError extends DomainError {
  readonly kind: DomainErrorKind = "forbidden";
  constructor(message: string) {
    super(message);
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
