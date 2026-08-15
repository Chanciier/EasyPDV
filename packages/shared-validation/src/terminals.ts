import { z } from "zod";

/**
 * Provisionamento de terminal (Sprint 10) — Intermediador. Ver docs/DATABASE.md
 * e Claude/Projetos/EasyPDV/Decisões e Riscos Abertos.md no cofre Obsidian.
 */

export const createOrganizationSchema = z.object({
  name: z.string().min(1),
  document: z.string().optional(),
});

// storeId (loja existente, novo terminal na mesma loja) OU storeName (cria uma loja nova).
export const generateActivationCodeSchema = z
  .object({
    storeId: z.string().optional(),
    storeName: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.storeId) !== Boolean(data.storeName), {
    message: "Informe exatamente um de storeId ou storeName",
  });

export const activateTerminalSchema = z.object({
  code: z.string().min(1),
  terminalName: z.string().optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type GenerateActivationCodeInput = z.infer<typeof generateActivationCodeSchema>;
export type ActivateTerminalInput = z.infer<typeof activateTerminalSchema>;
