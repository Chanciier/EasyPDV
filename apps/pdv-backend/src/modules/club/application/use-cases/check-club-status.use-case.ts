import { Inject, Injectable, Logger } from "@nestjs/common";
import { CLUB_GATEWAY, type ClubGatewayPort } from "../ports/club-gateway.port.js";

/** Fail-open (mesma postura de GetFiscalStatusUseCase): falha de rede nunca bloqueia a venda, só significa "não aplica desconto de clube". */
@Injectable()
export class CheckClubStatusUseCase {
  private readonly logger = new Logger(CheckClubStatusUseCase.name);

  constructor(@Inject(CLUB_GATEWAY) private readonly clubGateway: ClubGatewayPort) {}

  async execute(document: string): Promise<boolean> {
    try {
      const isMember = await this.clubGateway.checkStatus(document);
      return isMember ?? false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Não foi possível consultar status de clube pro CPF ${document}: ${message}`);
      return false;
    }
  }
}
