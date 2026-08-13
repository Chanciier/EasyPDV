import { z } from "zod";

export const createWarehouseSchema = z.object({
  name: z.string().min(1),
});

export const stockMovementTypeSchema = z.enum(["entrada", "saida", "ajuste", "venda", "devolucao"]);

/**
 * `quantity` é sempre o delta assinado a aplicar no saldo (positivo aumenta,
 * negativo diminui) — `type` só documenta o motivo. Ver docs/DATABASE.md.
 */
export const registerStockMovementSchema = z.object({
  warehouseId: z.string().min(1),
  productId: z.string().min(1),
  type: stockMovementTypeSchema,
  quantity: z.number().refine((v) => v !== 0, "quantity não pode ser zero"),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type RegisterStockMovementInput = z.infer<typeof registerStockMovementSchema>;
