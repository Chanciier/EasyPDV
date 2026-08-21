import { Inject, Injectable } from "@nestjs/common";
import type { CreateUserInput } from "@easypdv/shared-validation";
import { EmailAlreadyInUseError } from "../../domain/errors.js";
import type { User } from "../../domain/entities/user.entity.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";
import { USER_REPOSITORY, type UserRepositoryPort } from "../ports/user-repository.port.js";
import {
  USER_VERIFICATION_GATEWAY,
  type UserVerificationGatewayPort,
} from "../ports/user-verification-gateway.port.js";

/**
 * Login único entre terminais (2026-08-21): usuário novo nasce no
 * Intermediador PRIMEIRO (fonte da verdade da senha) — sem fila offline pra
 * isso (ação rara de admin, diferente de venda). Se o Intermediador estiver
 * fora, a criação falha com erro claro em vez de criar um usuário só local
 * que nunca vai funcionar em outro terminal.
 */
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(USER_VERIFICATION_GATEWAY) private readonly userVerificationGateway: UserVerificationGatewayPort,
  ) {}

  async execute(input: CreateUserInput): Promise<User> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new EmailAlreadyInUseError(input.email);
    }

    const centralUser = await this.userVerificationGateway.createCentralUser(input);

    const passwordHash = await this.passwordHasher.hash(input.password);
    const maxEmployeeCode = await this.userRepository.getMaxEmployeeCode();
    return this.userRepository.create({
      name: centralUser.name,
      email: centralUser.email,
      passwordHash,
      role: centralUser.role,
      employeeCode: maxEmployeeCode + 1,
      orgUserId: centralUser.id,
    });
  }
}
