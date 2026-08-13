/** Erros de domínio — mapeados para HTTP na camada de infrastructure/controllers. */

export class InvalidCredentialsError extends Error {
  constructor() {
    super("E-mail ou senha inválidos");
  }
}

export class InactiveUserError extends Error {
  constructor() {
    super("Usuário inativo");
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super("Refresh token inválido ou expirado");
  }
}

export class EmailAlreadyInUseError extends Error {
  constructor(email: string) {
    super(`Já existe um usuário com o e-mail ${email}`);
  }
}

export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`Usuário ${id} não encontrado`);
  }
}
