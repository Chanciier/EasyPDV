import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuditModule } from "../audit/audit.module.js";
import { AuthController } from "./infrastructure/controllers/auth.controller.js";
import { UsersController } from "./infrastructure/controllers/users.controller.js";
import { PrismaAuthSessionRepository } from "./infrastructure/repositories/prisma-auth-session.repository.js";
import { PrismaUserRepository } from "./infrastructure/repositories/prisma-user.repository.js";
import { BcryptPasswordHasher } from "./infrastructure/services/bcrypt-password-hasher.service.js";
import { JwtStrategy } from "./infrastructure/strategies/jwt.strategy.js";
import { AUTH_SESSION_REPOSITORY } from "./application/ports/auth-session-repository.port.js";
import { PASSWORD_HASHER } from "./application/ports/password-hasher.port.js";
import { USER_REPOSITORY } from "./application/ports/user-repository.port.js";
import { CreateUserUseCase } from "./application/use-cases/create-user.use-case.js";
import { GetCurrentUserUseCase } from "./application/use-cases/get-current-user.use-case.js";
import { ListUsersUseCase } from "./application/use-cases/list-users.use-case.js";
import { LoginUseCase } from "./application/use-cases/login.use-case.js";
import { LogoutUseCase } from "./application/use-cases/logout.use-case.js";
import { RefreshTokenUseCase } from "./application/use-cases/refresh-token.use-case.js";
import { UpdateUserRoleUseCase } from "./application/use-cases/update-user-role.use-case.js";

@Module({
  imports: [
    AuditModule,
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
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: AUTH_SESSION_REPOSITORY, useClass: PrismaAuthSessionRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
  ],
})
export class IdentityModule {}
