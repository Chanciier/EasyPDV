import { z } from "zod";

/**
 * Schemas usados tanto no backend (DTO de entrada) quanto no frontend (validação de formulário) —
 * mesma fonte de verdade sobre o que é uma venda válida. Ver Claude/Projetos/EasyPDV no cofre Obsidian.
 */

export const createSaleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
});

export const registerPaymentSchema = z.object({
  method: z.enum(["dinheiro", "cartao", "pix", "outro"]),
  amount: z.number().positive(),
  authorizationCode: z.string().optional(),
});

export const openCashSessionSchema = z.object({
  cashRegisterId: z.string().min(1),
  openingAmount: z.number().nonnegative(),
});

export const closeCashSessionSchema = z.object({
  closingAmount: z.number().nonnegative(),
});

export type CreateSaleItemInput = z.infer<typeof createSaleItemSchema>;
export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;
