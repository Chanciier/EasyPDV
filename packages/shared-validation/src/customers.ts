import { z } from "zod";

// Telefone obrigatório no cadastro manual (2026-09-14, pedido do usuário) —
// sem telefone o cliente nunca pode receber lembrete de WhatsApp (Clube,
// Vale-Troca). Só no CADASTRO: updateCustomerSchema (edição) continua com
// phone opcional/anulável, e o import do Bling (ImportCustomersFromBlingUseCase)
// grava direto no repositório, sem passar por este schema — contato do
// Bling sem celular continua permitido ali (dado real de fora, não dá pra
// exigir o que a origem não tem).
export const createCustomerSchema = z.object({
  name: z.string().min(1),
  document: z.string().optional(),
  phone: z.string().min(1),
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
