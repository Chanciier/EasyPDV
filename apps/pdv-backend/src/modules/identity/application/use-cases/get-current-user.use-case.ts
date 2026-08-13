import { Inject, Injectable } from "@nestjs/common";
import { UserNotFoundError } from "../../domain/errors.js";
import type { User } from "../../domain/entities/user.entity.js";
import { USER_REPOSITORY, type UserRepositoryPort } from "../ports/user-repository.port.js";

@Injectable()
export class GetCurrentUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort) {}

  async execute(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }
    return user;
  }
}
