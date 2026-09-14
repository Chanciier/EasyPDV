import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  document: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  document: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
});

/** `PATCH /admin/club/members/:document/whatsapp-consent` (painel admin, Fase 2) — ver SetWhatsappConsentUseCase. */
export const setWhatsappConsentSchema = z.object({
  consent: z.boolean(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type SetWhatsappConsentInput = z.infer<typeof setWhatsappConsentSchema>;
