import { Inject, Injectable } from "@nestjs/common";
import type { ActivationCodeResult } from "@easypdv/shared-types";
import {
  ACTIVATION_CODE_GATEWAY,
  type ActivationCodeGatewayPort,
} from "../ports/activation-code-gateway.port.js";

/** Chamado pelo POST /provisioning/activation-codes (admin-only) — tela Administração, aba "Ativar novo terminal". */
@Injectable()
export class GenerateActivationCodeUseCase {
  constructor(
    @Inject(ACTIVATION_CODE_GATEWAY) private readonly activationCodeGateway: ActivationCodeGatewayPort,
  ) {}

  execute(storeName: string): Promise<ActivationCodeResult> {
    return this.activationCodeGateway.generate(storeName);
  }
}
