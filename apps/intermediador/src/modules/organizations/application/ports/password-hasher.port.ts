/** Porta — isola bcrypt do domínio/application. Mesmo padrão de apps/pdv-backend/identity. Implementação em infrastructure/services. */
export interface PasswordHasherPort {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol("PASSWORD_HASHER");
