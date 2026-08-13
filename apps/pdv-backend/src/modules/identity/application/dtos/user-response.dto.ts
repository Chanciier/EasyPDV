import type { User } from "@easypdv/shared-types";
import type { User as UserEntity } from "../../domain/entities/user.entity.js";

/** Nunca inclui passwordHash — fronteira explícita entre Entity e o que sai pela API. */
export function toUserResponseDto(user: UserEntity): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
  };
}
