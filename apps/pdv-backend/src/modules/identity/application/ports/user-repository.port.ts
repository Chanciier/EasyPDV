import type { User } from "../../domain/entities/user.entity.js";

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: User["role"];
  employeeCode: number;
}

/** Porta — implementação concreta fica em infrastructure/repositories. */
export interface UserRepositoryPort {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  create(data: CreateUserData): Promise<User>;
  updateRole(id: string, role: User["role"]): Promise<User>;
  existsAny(): Promise<boolean>;
  /** 0 se ainda não existe nenhum usuário — CreateUserUseCase soma 1 pra próxima matrícula. */
  getMaxEmployeeCode(): Promise<number>;
}

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");
