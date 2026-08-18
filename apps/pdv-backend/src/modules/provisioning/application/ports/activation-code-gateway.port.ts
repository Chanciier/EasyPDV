import type { ActivationCodeResult } from "@easypdv/shared-types";

export interface ActivationCodeGatewayPort {
  generate(storeName: string): Promise<ActivationCodeResult>;
}

export const ACTIVATION_CODE_GATEWAY = Symbol("ACTIVATION_CODE_GATEWAY");
