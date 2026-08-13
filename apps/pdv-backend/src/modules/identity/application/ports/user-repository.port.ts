import type { User } from "../../domain/entities/user.entity.js";

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: User["role"];
}

/** Porta — implementação concreta fica em infrastructure/repositories. */
export interface UserRepositoryPort {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  updateRole(id: string, role: User["role"]): Promise<User>;
  existsAny(): Promise<boolean>;
}

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");
