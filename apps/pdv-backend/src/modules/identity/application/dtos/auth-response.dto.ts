import type { AuthTokens, User } from "@easypdv/shared-types";

export interface LoginResponseDto {
  user: User;
  tokens: AuthTokens;
}
