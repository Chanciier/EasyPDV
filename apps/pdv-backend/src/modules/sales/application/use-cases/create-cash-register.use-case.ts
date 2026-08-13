import { Inject, Injectable } from "@nestjs/common";
import type { CashRegister } from "@easypdv/shared-types";
import { CASH_REPOSITORY, type CashRepositoryPort } from "../ports/cash-repository.port.js";

@Injectable()
export class CreateCashRegisterUseCase {
  constructor(@Inject(CASH_REPOSITORY) private readonly cashRepository: CashRepositoryPort) {}

  execute(name: string): Promise<CashRegister> {
    return this.cashRepository.createRegister(name);
  }
}
