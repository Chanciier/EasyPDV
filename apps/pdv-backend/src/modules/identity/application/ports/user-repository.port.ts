import type { User } from "../../domain/entities/user.entity.js";

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: User["role"];
  employeeCode: number;
  /** Presente quando o usuário nasce de uma criação central (CreateUserUseCase, login único). Ausente/null pra criação puramente local. */
  orgUserId?: string | null;
}

/** Login único entre terminais (2026-08-21) — dados atualizados a cada login central bem-sucedido. Ver login.use-case.ts `mirrorCentralUser`. */
export interface MirrorUserData {
  name: string;
  passwordHash: string;
  role: User["role"];
  active: boolean;
  orgUserId: string;
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
  /** Cria (se `email` for novo) ou atualiza (casando por `email`) o espelho local, sempre marcando `lastVerifiedCentrallyAt = now()`. */
  upsertCentralMirror(email: string, data: MirrorUserData): Promise<User>;
  /** Só atualiza o timestamp — usado quando o Intermediador confirma que o usuário segue ativo, sem precisar reescrever o resto. */
  touchLastVerifiedCentrally(id: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");
