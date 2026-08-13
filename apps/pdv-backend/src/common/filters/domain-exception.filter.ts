import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
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
    return new InternalServerErrorException();
  }
}
