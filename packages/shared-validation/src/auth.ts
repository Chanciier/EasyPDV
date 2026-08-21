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

/**
 * `PATCH /organizations/:id/users/:userId` no Intermediador (login único
 * entre terminais, 2026-08-21) — role e active são independentes e opcionais
 * (admin pode editar um sem mexer no outro), mas pelo menos um precisa vir.
 */
export const updateOrgUserSchema = z
  .object({
    role: userRoleSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => data.role !== undefined || data.active !== undefined, {
    message: "Informe role e/ou active",
  });

// Troca/reset de senha (2026-08-21).
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/** `PATCH /users/:id/reset-password` — admin não precisa saber a senha atual do outro usuário. */
export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

/** `PATCH /organizations/:id/users/:userId/password` no Intermediador — mesmo corpo de resetPasswordSchema, schema próprio pra não acoplar os dois lados. */
export const changeOrgUserPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateOrgUserInput = z.infer<typeof updateOrgUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangeOrgUserPasswordInput = z.infer<typeof changeOrgUserPasswordSchema>;
