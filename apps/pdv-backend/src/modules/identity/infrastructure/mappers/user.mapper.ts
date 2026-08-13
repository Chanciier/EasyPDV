import type { User as PrismaUser } from "@prisma/client";
import { User } from "../../domain/entities/user.entity.js";

export function toDomainUser(record: PrismaUser): User {
  return new User({
    id: record.id,
    name: record.name,
    email: record.email,
    passwordHash: record.passwordHash,
    role: record.role,
    active: record.active,
  });
}
