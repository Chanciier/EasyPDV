import type { ActivationCodeResult } from "@easypdv/shared-types";

export interface ActivationCodeGatewayPort {
  /** Sempre pra um terminal novo na MESMA loja do terminal que está pedindo — ver StoreIdentity local. */
  generate(): Promise<ActivationCodeResult>;
}

export const ACTIVATION_CODE_GATEWAY = Symbol("ACTIVATION_CODE_GATEWAY");
