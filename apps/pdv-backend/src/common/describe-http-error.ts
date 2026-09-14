import { HttpException } from "@nestjs/common";

/**
 * Corpo de erro do Intermediador pode vir de dois jeitos: um DomainError
 * mapeado (`{message}`, ver DomainExceptionFilter) ou uma falha do
 * ZodValidationPipe (`{fieldErrors, formErrors}`, sem `message` nenhum — ver
 * zod-validation.pipe.ts). Sem tratar o segundo caso, a mensagem some — não
 * dá pra dizer qual campo (achado real, 2026-09-11: telefone vazio
 * quebrando Vale-Troca — ver docs/CHANGELOG.md).
 *
 * **Lança `HttpException` de propósito, não `Error`** (achado real,
 * 2026-09-14: mesmo com a mensagem certa extraída, `DomainExceptionFilter`
 * descarta qualquer `Error` simples — só loga no servidor, devolve 500
 * genérico SEM corpo nenhum pro cliente. O fix de 2026-09-11 melhorou só o
 * log, nunca chegou a aparecer pro operador). `HttpException` passa direto
 * pelo filtro (`instanceof HttpException` é o primeiro `if`), preservando o
 * status de verdade que o Intermediador respondeu.
 *
 * Extraído pra cá (2026-09-14) depois de duplicado em HttpStoreCreditGateway
 * e HttpCustomerRepository — qualquer gateway novo que fale com o
 * Intermediador deveria usar este helper em vez de repetir.
 */
export async function throwDescriptiveHttpError(response: Response, requestLabel: string): Promise<never> {
  const body = (await response.json().catch(() => null)) as
    | { message?: string; fieldErrors?: Record<string, string[]>; formErrors?: string[] }
    | null;

  let message = `Intermediador respondeu ${response.status} para ${requestLabel}`;
  if (body?.message) {
    message = body.message;
  } else {
    const fieldIssues = body?.fieldErrors
      ? Object.entries(body.fieldErrors)
          .map(([field, issues]) => `${field}: ${issues.join(", ")}`)
          .join("; ")
      : "";
    if (fieldIssues || body?.formErrors?.length) {
      message = [fieldIssues, ...(body?.formErrors ?? [])].filter(Boolean).join("; ");
    }
  }

  throw new HttpException(message, response.status);
}
