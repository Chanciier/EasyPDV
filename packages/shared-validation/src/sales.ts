import { z } from "zod";
import { isValidCpf } from "./document.js";

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

// Sprint 5: pagamento e confirmação da venda. cardType/installments (Sprint
// 14) só fazem sentido quando method="cartao" — reforçado via .refine()
// abaixo em vez de um schema discriminated union, pra manter o formato de
// entrada simples pro frontend (um objeto só, campos condicionalmente vazios).
export const registerPaymentSchema = z
  .object({
    method: z.enum(["dinheiro", "cartao", "pix", "vale_troca", "outro"]),
    amount: z.number().positive(),
    cardType: z.enum(["credito", "debito"]).optional(),
    // Bandeira do cartão (2026-08-21) — bate com as formas de pagamento reais
    // configuradas no Bling ("Crédito (Mastercard)", "Crédito (Visa)", etc).
    cardBrand: z.enum(["mastercard", "visa"]).optional(),
    installments: z.number().int().positive().optional(),
    authorizationCode: z.string().optional(),
  })
  .refine((data) => data.method === "cartao" || data.cardType === undefined, {
    message: "cardType só é válido quando method é 'cartao'",
    path: ["cardType"],
  })
  .refine((data) => data.method === "cartao" || data.cardBrand === undefined, {
    message: "cardBrand só é válido quando method é 'cartao'",
    path: ["cardBrand"],
  })
  .refine((data) => data.method === "cartao" || data.installments === undefined, {
    message: "installments só é válido quando method é 'cartao'",
    path: ["installments"],
  });

// Desconto fixo (R$) no total da venda — aplicável por qualquer operador
// autenticado enquanto a venda ainda está em rascunho.
export const applySaleDiscountSchema = z.object({
  discountAmount: z.number().nonnegative(),
});

// Estorno de venda confirmada (Sprint 14) — motivo obrigatório, diferente do
// motivo opcional de movimento de caixa, já que reverte uma transação
// completa e possivelmente já sincronizada com o Bling.
export const voidSaleSchema = z.object({
  reason: z.string().min(1),
});

// "CPF na nota" (2026-08-19) — anexa/troca o cliente de uma venda já
// iniciada. `name` opcional (convenção de balcão: cliente geralmente só
// informa o CPF) — default vira "Consumidor CPF {cpf formatado}" no
// use-case quando não vem nome. Validação de dígito verificador aqui
// mesmo (defesa em profundidade — o frontend também valida antes de
// habilitar o submit, mas o backend nunca confia só nisso).
export const attachCustomerToSaleSchema = z.object({
  document: z.string().refine(isValidCpf, { message: "CPF inválido" }),
  name: z.string().min(1).optional(),
});

export type StartSaleInput = z.infer<typeof startSaleSchema>;
export type AddSaleItemInput = z.infer<typeof addSaleItemSchema>;
export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;
export type ApplySaleDiscountInput = z.infer<typeof applySaleDiscountSchema>;
export type VoidSaleInput = z.infer<typeof voidSaleSchema>;
export type AttachCustomerToSaleInput = z.infer<typeof attachCustomerToSaleSchema>;
