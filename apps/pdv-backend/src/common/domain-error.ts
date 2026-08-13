export type DomainErrorKind = "not_found" | "conflict" | "unauthorized" | "forbidden";

/**
 * Base para erros de domínio — carrega o "tipo" de falha HTTP sem que o
 * domínio precise importar nada do Nest. O filtro global só lê `kind`,
 * então novos módulos não precisam editar o filtro. Ver docs/CODING-STANDARDS.md.
 */
export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;
}
