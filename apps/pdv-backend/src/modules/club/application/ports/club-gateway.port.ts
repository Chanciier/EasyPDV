export interface ClubMember {
  document: string;
  name: string;
  validUntil: string | null;
}

export interface AddClubMemberInput {
  name: string;
  document: string;
  validUntil: string;
  phone: string;
}

export interface ClubGatewayPort {
  checkStatus(document: string): Promise<boolean | null>;
  listMembers(): Promise<ClubMember[]>;
  addMember(input: AddClubMemberInput): Promise<ClubMember>;
  removeMember(document: string): Promise<void>;
}

export const CLUB_GATEWAY = Symbol("CLUB_GATEWAY");
