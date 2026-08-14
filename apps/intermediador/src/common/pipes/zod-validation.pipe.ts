import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Valida o body da requisição contra um schema Zod de @easypdv/shared-validation —
 * mesma fonte de verdade usada pelo PDV local e pelo frontend. Ver docs/CODING-STANDARDS.md.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return result.data;
  }
}
