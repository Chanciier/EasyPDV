import { z } from "zod";

export const userRoleSchema = z.enum([
  "operador",
  "supervisor",
  "gerente",
  "administrador",
  "proprietario",
  "auditor",
  "tecnico",
]);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: userRoleSchema,
});

export const updateUserRoleSchema = z.object({
  role: userRoleSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
