import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Response } from "express";
import { DomainError, type DomainErrorKind } from "../domain-error.js";

const KIND_TO_EXCEPTION: Record<DomainErrorKind, new (message: string) => HttpException> = {
  not_found: NotFoundException,
  conflict: ConflictException,
  unauthorized: UnauthorizedException,
  forbidden: ForbiddenException,
};

/**
 * Traduz erros de domínio (DomainError, sem dependência de HTTP) para o status
 * correspondente via `kind` — nenhum módulo novo precisa editar este filtro.
 * Ver docs/CODING-STANDARDS.md — "Controllers finos, sem regra de negócio".
 */
@Catch(Error)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const httpException = this.toHttpException(exception);
    response.status(httpException.getStatus()).json(httpException.getResponse());
  }

  private toHttpException(exception: Error): HttpException {
    if (exception instanceof HttpException) {
      return exception;
    }
    if (exception instanceof DomainError) {
      const ExceptionClass = KIND_TO_EXCEPTION[exception.kind];
      return new ExceptionClass(exception.message);
    }
    // Erro não mapeado (bug real ou falha inesperada) — sem isso, o 500
    // chega ao cliente sem NENHUM rastro no log (achado depurando um 500
    // silencioso na ativação de terminal que só apareceu de verdade aqui).
    this.logger.error(exception.message, exception.stack);
    return new InternalServerErrorException();
  }
}
