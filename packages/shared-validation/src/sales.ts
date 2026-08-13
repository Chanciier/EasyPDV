import { z } from "zod";

/**
 * Schemas usados tanto no backend (DTO de entrada) quanto no frontend
 * (validação de formulário) — mesma fonte de verdade sobre o que é uma venda
 * válida. Ver docs/DATABASE.md. Cash session/movement ficam em cash.ts.
 */

export const startSaleSchema = z.object({
  cashSessionId: z.string().min(1),
  customerId: z.string().optional(),
});

export const addSaleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
});

// Sprint 5: pagamento e confirmação da venda.
export const registerPaymentSchema = z.object({
  method: z.enum(["dinheiro", "cartao", "pix", "outro"]),
  amount: z.number().positive(),
  authorizationCode: z.string().optional(),
});

export type StartSaleInput = z.infer<typeof startSaleSchema>;
export type AddSaleItemInput = z.infer<typeof addSaleItemSchema>;
export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;
