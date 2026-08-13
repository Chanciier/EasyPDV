import type { User } from "../entities/user.entity.js";

/** Regra estrutural reutilizável — usuário inativo nunca pode autenticar. */
export class IsUserActiveSpecification {
  isSatisfiedBy(user: User): boolean {
    return user.active;
  }
}
