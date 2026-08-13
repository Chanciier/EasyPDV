import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, ForbiddenException, HttpException, InternalServerErrorException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { Response } from "express";
import {
  EmailAlreadyInUseError,
  InactiveUserError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  UserNotFoundError,
} from "../../modules/identity/domain/errors.js";

/**
 * Traduz erros de domínio (classes de Error puras, sem dependência de HTTP)
 * para o status HTTP correspondente. Mantém Use Cases livres de conhecer Nest.
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
    if (exception instanceof InvalidCredentialsError || exception instanceof InvalidRefreshTokenError) {
      return new UnauthorizedException(exception.message);
    }
    if (exception instanceof InactiveUserError) {
      return new ForbiddenException(exception.message);
    }
    if (exception instanceof EmailAlreadyInUseError) {
      return new ConflictException(exception.message);
    }
    if (exception instanceof UserNotFoundError) {
      return new NotFoundException(exception.message);
    }
    return new InternalServerErrorException();
  }
}
