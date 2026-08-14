import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const AUTHORIZE_URL = "https://www.bling.com.br/Api/v3/oauth/authorize";
const TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";

export interface BlingTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface BlingTokenApiResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

/**
 * Fluxo OAuth2 do Bling API v3 (authorization_code). Endpoints e regras
 * confirmados via developer.bling.com.br + spec pública (2026-08-14):
 * autorização e token ficam em www.bling.com.br (não api.bling.com.br);
 * token endpoint exige HTTP Basic client_id:client_secret (nunca no body);
 * o refresh_token roda a cada uso — o resultado de refreshToken() sempre
 * substitui os dois tokens, nunca só o access_token.
 */
@Injectable()
export class BlingOAuthClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(configService: ConfigService) {
    this.clientId = configService.getOrThrow<string>("BLING_CLIENT_ID");
    this.clientSecret = configService.getOrThrow<string>("BLING_CLIENT_SECRET");
    this.redirectUri = configService.getOrThrow<string>("BLING_REDIRECT_URI");
  }

  buildAuthorizeUrl(state: string): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  }

  exchangeCode(code: string): Promise<BlingTokenResult> {
    return this.requestToken({ grant_type: "authorization_code", code, redirect_uri: this.redirectUri });
  }

  refreshToken(refreshToken: string): Promise<BlingTokenResult> {
    return this.requestToken({ grant_type: "refresh_token", refresh_token: refreshToken });
  }

  private async requestToken(params: Record<string, string>): Promise<BlingTokenResult> {
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(params).toString(),
    });

    const body = (await response.json().catch(() => null)) as BlingTokenApiResponse | null;
    if (!response.ok || !body?.access_token || !body.refresh_token || !body.expires_in) {
      throw new BadRequestException(
        `Bling OAuth falhou (HTTP ${response.status}): ${body?.error_description ?? body?.error ?? JSON.stringify(body)}`,
      );
    }

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
    };
  }
}
