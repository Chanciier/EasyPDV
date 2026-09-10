import { z } from "zod";
import { isValidCpf } from "./document.js";

/**
 * Vale-Troca (2026-09-10) — crédito de troca vinculado a CPF. Ver
 * Planejamento - Vale-Troca (Crédito por CPF).md no cofre Obsidian.
 *
 * `discountAmount` aqui é o mesmo desenho de `ApplyItemDiscountUseCase`
 * (pdv-backend/sales): um valor em R$ escolhido manualmente pelo operador
 * por item — nunca uma porcentagem solta trafegando pro backend (o
 * front-end converte % → R$ antes de enviar, mesma convenção já usada no
 * desconto de sócio do Clube). `totalAmount` da linha é sempre recalculado
 * no backend (quantity*unitPrice - discountAmount), nunca confiado do
 * cliente — mesmo motivo de ItemDiscountExceedsLineTotalError existir lá.
 */
export const grantStoreCreditItemSchema = z.object({
  productSku: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().default(0),
  // Volta pro estoque local (StockMovement "devolucao") ou não (avariado/descartado) — decisão por item, pedido do usuário.
  restock: z.boolean().default(true),
});

export const grantStoreCreditSchema = z.object({
  document: z.string().refine(isValidCpf, { message: "CPF inválido" }),
  // Só usados quando o Customer é novo (mesma regra de AttachCustomerToSaleUseCase,
  // mas aqui nome/telefone são pedidos ativamente — não é opcional como numa venda normal).
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().min(1).optional(),
  items: z.array(grantStoreCreditItemSchema).min(1),
});

export const redeemStoreCreditSchema = z.object({
  document: z.string().refine(isValidCpf, { message: "CPF inválido" }),
  amount: z.number().positive(),
  // Id da Sale local (SQLite do terminal) — só pra auditoria cruzada manual no Intermediador, sem FK de verdade.
  saleReference: z.string().optional(),
});

export type GrantStoreCreditItemInput = z.infer<typeof grantStoreCreditItemSchema>;
export type GrantStoreCreditInput = z.infer<typeof grantStoreCreditSchema>;
export type RedeemStoreCreditInput = z.infer<typeof redeemStoreCreditSchema>;
