import { z } from "zod";
import { isValidCpf } from "./document.js";

export const addClubMemberSchema = z.object({
  name: z.string().min(1),
  document: z.string().refine(isValidCpf, { message: "CPF inválido" }),
  validUntil: z.string().min(1),
  // Celular do sócio (2026-09-02, pedido do usuário) — vai pro campo "celular"
  // do contato no Bling (confirmado na doc oficial da API v3: "celular" é o
  // campo de celular, "telefone" seria fixo — clube usa celular).
  phone: z.string().min(1),
  // Aceite de lembrete por WhatsApp (2026-09-14, Fase 1 do lembrete de
  // renovação) — checkbox explícito na tela de cadastro do sócio. Vira
  // Customer.whatsappConsentAt no Intermediador; desmarcar depois de já ter
  // aceitado registra revogação (whatsappOptOutAt), ver AddClubMemberUseCase.
  whatsappConsent: z.boolean(),
});

export type AddClubMemberInput = z.infer<typeof addClubMemberSchema>;
