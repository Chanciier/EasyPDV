import { Inject, Injectable } from "@nestjs/common";
import type { User } from "../../domain/entities/user.entity.js";
import { USER_REPOSITORY, type UserRepositoryPort } from "../ports/user-repository.port.js";

@Injectable()
export class ListUsersUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort) {}

  async execute(): Promise<User[]> {
    return this.userRepository.findAll();
  }
}
