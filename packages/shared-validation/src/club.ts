import { z } from "zod";
import { isValidCpf } from "./document.js";

export const addClubMemberSchema = z.object({
  name: z.string().min(1),
  document: z.string().refine(isValidCpf, { message: "CPF inválido" }),
  validUntil: z.string().min(1),
});

export type AddClubMemberInput = z.infer<typeof addClubMemberSchema>;
