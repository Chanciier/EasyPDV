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
});

export type AddClubMemberInput = z.infer<typeof addClubMemberSchema>;
