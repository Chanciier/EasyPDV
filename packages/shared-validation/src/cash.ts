import { z } from "zod";

export const createCashRegisterSchema = z.object({
  name: z.string().min(1),
});

export const openCashSessionSchema = z.object({
  cashRegisterId: z.string().min(1),
  openingAmount: z.number().nonnegative(),
  terminalId: z.string().optional(),
});

export const closeCashSessionSchema = z.object({
  closingAmount: z.number().nonnegative(),
});

export const registerCashMovementSchema = z.object({
  type: z.enum(["sangria", "suprimento", "ajuste"]),
  amount: z.number().positive(),
  reason: z.string().optional(),
});

export type CreateCashRegisterInput = z.infer<typeof createCashRegisterSchema>;
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;
export type RegisterCashMovementInput = z.infer<typeof registerCashMovementSchema>;
