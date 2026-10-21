import { Inject, Injectable } from "@nestjs/common";
import {
  STORE_CREDIT_GATEWAY,
  type StoreCreditBalanceRow,
  type StoreCreditGatewayPort,
} from "../ports/store-credit-gateway.port.js";

/** `GET /store-credit/balances` — lista de clientes com vale-troca, repassada do Intermediador. */
@Injectable()
export class ListStoreCreditBalancesUseCase {
  constructor(@Inject(STORE_CREDIT_GATEWAY) private readonly storeCreditGateway: StoreCreditGatewayPort) {}

  execute(query?: string): Promise<StoreCreditBalanceRow[]> {
    return this.storeCreditGateway.listBalances(query);
  }
}
