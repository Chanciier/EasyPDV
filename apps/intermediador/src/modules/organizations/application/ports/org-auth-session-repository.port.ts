export interface CreateOrgAuthSessionData {
  orgUserId: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

export interface OrgAuthSessionRecord {
  id: string;
  orgUserId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** Porta — implementação concreta fica em infrastructure/repositories. Espelha AuthSessionRepositoryPort do pdv-backend. */
export interface OrgAuthSessionRepositoryPort {
  create(data: CreateOrgAuthSessionData): Promise<OrgAuthSessionRecord>;
  findById(id: string): Promise<OrgAuthSessionRecord | null>;
  revoke(id: string): Promise<void>;
}

export const ORG_AUTH_SESSION_REPOSITORY = Symbol("ORG_AUTH_SESSION_REPOSITORY");
