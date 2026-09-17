import { z } from "zod";

// Telefone opcional (2026-09-17, corrigido — decisão de 2026-09-14 exigia
// obrigatório aqui, mas esse schema também é usado pra criar o Customer
// mínimo (nome + CPF) de "CPF na nota" durante uma venda, ver
// AttachCustomerToSaleUseCase — regra do usuário: CPF sozinho já dá direito
// a nota fiscal, sem precisar de cadastro completo; telefone só entra com
// Clube (benefícios + lembrete de WhatsApp). Exigir telefone aqui bloqueava
// TODA venda com CPF pra cliente novo fora do Clube (achado real de
// produção). O cadastro manual (tela Clientes) continua pedindo telefone —
// exigência é só no FRONTEND (`customers-view.tsx`), não neste schema
// compartilhado por dois fluxos com regras diferentes.
export const createCustomerSchema = z.object({
  name: z.string().min(1),
  document: z.string().optional(),
  phone: z.string().min(1).optional(),
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
