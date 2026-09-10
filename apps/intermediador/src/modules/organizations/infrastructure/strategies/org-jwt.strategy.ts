import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

export interface OrgJwtPayload {
  sub: string;
  organizationId: string;
  role: string;
}

/**
 * Nome de estratégia default ("jwt") — sem colisão possível com o
 * pdv-backend: são processos Nest inteiramente separados, cada um com seu
 * próprio container de DI. Ver OrgLoginUseCase pro que vai no payload.
 */
@Injectable()
export class OrgJwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_SECRET"),
    });
  }

  validate(payload: OrgJwtPayload) {
    return { orgUserId: payload.sub, organizationId: payload.organizationId, role: payload.role };
  }
}
