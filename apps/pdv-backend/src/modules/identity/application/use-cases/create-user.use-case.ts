import { Inject, Injectable } from "@nestjs/common";
import type { CreateUserInput } from "@easypdv/shared-validation";
import { EmailAlreadyInUseError } from "../../domain/errors.js";
import type { User } from "../../domain/entities/user.entity.js";
import { PASSWORD_HASHER, type PasswordHasherPort } from "../ports/password-hasher.port.js";
import { USER_REPOSITORY, type UserRepositoryPort } from "../ports/user-repository.port.js";

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: CreateUserInput): Promise<User> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new EmailAlreadyInUseError(input.email);
    }
    const passwordHash = await this.passwordHasher.hash(input.password);
    const maxEmployeeCode = await this.userRepository.getMaxEmployeeCode();
    return this.userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      employeeCode: maxEmployeeCode + 1,
    });
  }
}
