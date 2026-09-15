import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { USER_REPOSITORY, type UserRepositoryPort } from "../../application/ports/user-repository.port.js";

export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_SECRET"),
    });
  }

  /**
   * Busca `mustChangePassword` fresco do banco (não trafega no claim do JWT,
   * que é assinado uma vez no login e não muda até expirar) — é o que
   * permite ao `MustChangePasswordInterceptor` bloquear o resto da API
   * enquanto o admin de fallback (senha padrão pública, ver `main.ts`
   * `ensureAdminUser`) não trocar a senha, mesmo com um access token válido
   * emitido antes da troca. Usuário deletado depois do token ser emitido
   * (raro, mas possível) invalida a sessão em vez de confiar cegamente no
   * claim assinado.
   */
  async validate(payload: JwtPayload) {
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { userId: payload.sub, role: payload.role, mustChangePassword: user.mustChangePassword };
  }
}
