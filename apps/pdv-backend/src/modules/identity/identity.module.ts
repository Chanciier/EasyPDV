import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuditModule } from "../audit/audit.module.js";
import { ProvisioningModule } from "../provisioning/provisioning.module.js";
import { AuthController } from "./infrastructure/controllers/auth.controller.js";
import { UsersController } from "./infrastructure/controllers/users.controller.js";
import { PrismaAuthSessionRepository } from "./infrastructure/repositories/prisma-auth-session.repository.js";
import { PrismaUserRepository } from "./infrastructure/repositories/prisma-user.repository.js";
import { BcryptPasswordHasher } from "./infrastructure/services/bcrypt-password-hasher.service.js";
import { HttpUserVerificationGateway } from "./infrastructure/gateways/http-user-verification.gateway.js";
import { JwtStrategy } from "./infrastructure/strategies/jwt.strategy.js";
import { AUTH_SESSION_REPOSITORY } from "./application/ports/auth-session-repository.port.js";
import { PASSWORD_HASHER } from "./application/ports/password-hasher.port.js";
import { USER_REPOSITORY } from "./application/ports/user-repository.port.js";
import { USER_VERIFICATION_GATEWAY } from "./application/ports/user-verification-gateway.port.js";
import { CreateUserUseCase } from "./application/use-cases/create-user.use-case.js";
import { GetCurrentUserUseCase } from "./application/use-cases/get-current-user.use-case.js";
import { ListUsersUseCase } from "./application/use-cases/list-users.use-case.js";
import { LoginUseCase } from "./application/use-cases/login.use-case.js";
import { LogoutUseCase } from "./application/use-cases/logout.use-case.js";
import { RefreshTokenUseCase } from "./application/use-cases/refresh-token.use-case.js";
import { UpdateUserRoleUseCase } from "./application/use-cases/update-user-role.use-case.js";
import { ChangePasswordUseCase } from "./application/use-cases/change-password.use-case.js";
import { ResetUserPasswordUseCase } from "./application/use-cases/reset-user-password.use-case.js";

@Module({
  imports: [
    AuditModule,
    // Login único entre terminais (2026-08-21) — HttpUserVerificationGateway
    // lê a apiKey via StoreIdentityRepositoryPort, mesmo padrão de
    // FiscalModule/HttpFiscalGateway. ProvisioningModule não importa
    // IdentityModule de volta, sem risco de ciclo (ver docs/MODULES.md).
    ProvisioningModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: (config.get<string>("JWT_ACCESS_EXPIRES") ?? "15m") as `${number}${"s" | "m" | "h" | "d"}`,
        },
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    JwtStrategy,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    CreateUserUseCase,
    ListUsersUseCase,
    UpdateUserRoleUseCase,
    GetCurrentUserUseCase,
    ChangePasswordUseCase,
    ResetUserPasswordUseCase,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: AUTH_SESSION_REPOSITORY, useClass: PrismaAuthSessionRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: USER_VERIFICATION_GATEWAY, useClass: HttpUserVerificationGateway },
  ],
  // HttpUserVerificationGateway é usado fora do módulo também — main.ts
  // (`ensureAdminUser`, roda antes de qualquer request HTTP) resolve via
  // `app.get(USER_VERIFICATION_GATEWAY)` direto no container completo.
  exports: [USER_VERIFICATION_GATEWAY],
})
export class IdentityModule {}
