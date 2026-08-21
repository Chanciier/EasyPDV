import type { UserRole } from "@easypdv/shared-types";

export interface UserProps {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  employeeCode: number;
  /** Login único entre terminais (2026-08-21) — null pra usuário nunca confirmado centralmente. Ver user-verification-gateway.port.ts. */
  orgUserId: string | null;
  lastVerifiedCentrallyAt: Date | null;
  /** Troca/reset de senha (2026-08-21) — força a tela de troca antes de liberar o resto do app. */
  mustChangePassword: boolean;
}

/**
 * Entidade de domínio — não é o model do Prisma. O mapeamento acontece só no
 * Repository (infrastructure/mappers). Ver docs/CODING-STANDARDS.md.
 */
export class User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: UserRole;
  readonly active: boolean;
  readonly employeeCode: number;
  readonly orgUserId: string | null;
  readonly lastVerifiedCentrallyAt: Date | null;
  readonly mustChangePassword: boolean;

  constructor(props: UserProps) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.role = props.role;
    this.active = props.active;
    this.employeeCode = props.employeeCode;
    this.orgUserId = props.orgUserId;
    this.lastVerifiedCentrallyAt = props.lastVerifiedCentrallyAt;
    this.mustChangePassword = props.mustChangePassword;
  }
}
