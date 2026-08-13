import { Inject, Injectable } from "@nestjs/common";
import { CashSessionNotFoundError } from "../../domain/errors.js";
import type { CashSession } from "../../domain/entities/cash-session.entity.js";
import { CASH_REPOSITORY, type CashRepositoryPort } from "../ports/cash-repository.port.js";

@Injectable()
export class GetCashSessionUseCase {
  constructor(@Inject(CASH_REPOSITORY) private readonly cashRepository: CashRepositoryPort) {}

  async execute(id: string): Promise<CashSession> {
    const session = await this.cashRepository.findSessionById(id);
    if (!session) {
      throw new CashSessionNotFoundError(id);
    }
    return session;
  }
}
