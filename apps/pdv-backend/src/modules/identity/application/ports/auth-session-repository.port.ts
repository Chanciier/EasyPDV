export interface CreateAuthSessionData {
  userId: string;
  refreshTokenHash: string;
  terminalId: string | null;
  expiresAt: Date;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** Porta — implementação concreta fica em infrastructure/repositories. */
export interface AuthSessionRepositoryPort {
  create(data: CreateAuthSessionData): Promise<AuthSessionRecord>;
  findById(id: string): Promise<AuthSessionRecord | null>;
  revoke(id: string): Promise<void>;
}

export const AUTH_SESSION_REPOSITORY = Symbol("AUTH_SESSION_REPOSITORY");
