import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1),
  parentCategoryId: z.string().optional(),
});

export const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  categoryId: z.string().optional(),
  unit: z.string().min(1).default("un"),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  categoryId: z.string().nullable().optional(),
  unit: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export const addBarcodeSchema = z.object({
  code: z.string().min(1),
  type: z.enum(["ean13", "interno", "fornecedor"]).default("ean13"),
});

export const createPriceListSchema = z.object({
  name: z.string().min(1),
});

export const upsertPriceListItemSchema = z.object({
  productId: z.string().min(1),
  price: z.number().positive(),
  promotionalPrice: z.number().positive().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AddBarcodeInput = z.infer<typeof addBarcodeSchema>;
export type CreatePriceListInput = z.infer<typeof createPriceListSchema>;
export type UpsertPriceListItemInput = z.infer<typeof upsertPriceListItemSchema>;
