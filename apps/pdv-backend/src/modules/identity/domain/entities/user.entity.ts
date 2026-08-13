import type { UserRole } from "@easypdv/shared-types";

export interface UserProps {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
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

  constructor(props: UserProps) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.role = props.role;
    this.active = props.active;
  }
}
