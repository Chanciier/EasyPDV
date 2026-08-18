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

// Chamado pelo PDV local (POST /provisioning/activation-codes, admin-only) —
// só cria loja nova nesta V1, não suporta adicionar terminal a uma loja já
// existente (diferente do generateActivationCodeSchema acima, que é o
// contrato do Intermediador em si e aceita os dois casos).
export const generateActivationCodeForNewStoreSchema = z.object({
  storeName: z.string().min(1),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type GenerateActivationCodeInput = z.infer<typeof generateActivationCodeSchema>;
export type ActivateTerminalInput = z.infer<typeof activateTerminalSchema>;
export type GenerateActivationCodeForNewStoreInput = z.infer<typeof generateActivationCodeForNewStoreSchema>;
