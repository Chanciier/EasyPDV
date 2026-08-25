import { Inject, Injectable } from "@nestjs/common";
import { CLUB_GATEWAY, type ClubGatewayPort, type ClubMember } from "../ports/club-gateway.port.js";

@Injectable()
export class ListClubMembersUseCase {
  constructor(@Inject(CLUB_GATEWAY) private readonly clubGateway: ClubGatewayPort) {}

  execute(): Promise<ClubMember[]> {
    return this.clubGateway.listMembers();
  }
}
