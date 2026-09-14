import type { UserRole } from "@easypdv/shared-types";

export interface OrgUserProps {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  employeeCode: number;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

/**
 * Usuário canônico por organização (login único entre terminais, 2026-08-21).
 * Entidade de domínio — não é o model do Prisma. Ver docs/CODING-STANDARDS.md.
 */
export class OrgUser {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: UserRole;
  readonly active: boolean;
  readonly employeeCode: number;
  readonly failedLoginAttempts: number;
  readonly lockedUntil: Date | null;

  constructor(props: OrgUserProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.role = props.role;
    this.active = props.active;
    this.employeeCode = props.employeeCode;
    this.failedLoginAttempts = props.failedLoginAttempts;
    this.lockedUntil = props.lockedUntil;
  }

  /** Bloqueio de conta por tentativa (2026-09-14) — ver docblock do campo no schema.prisma. */
  get isLocked(): boolean {
    return this.lockedUntil !== null && this.lockedUntil.getTime() > Date.now();
  }
}
