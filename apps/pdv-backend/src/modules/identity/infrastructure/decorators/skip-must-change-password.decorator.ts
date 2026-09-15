import { SetMetadata } from "@nestjs/common";

export const SKIP_MUST_CHANGE_PASSWORD_KEY = "skipMustChangePassword";

/** Isenta a rota do bloqueio global de `MustChangePasswordInterceptor` — só pras rotas que o próprio fluxo de troca de senha precisa (ver AuthController). */
export const SkipMustChangePassword = () => SetMetadata(SKIP_MUST_CHANGE_PASSWORD_KEY, true);
