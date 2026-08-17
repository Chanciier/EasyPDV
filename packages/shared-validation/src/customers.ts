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

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
