export interface TerminalProps {
  id: string;
  storeId: string;
  name: string;
  apiKeyHash: string;
  activatedAt: Date;
  lastSeenAt: Date | null;
}

export class Terminal {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  readonly apiKeyHash: string;
  readonly activatedAt: Date;
  readonly lastSeenAt: Date | null;

  constructor(props: TerminalProps) {
    this.id = props.id;
    this.storeId = props.storeId;
    this.name = props.name;
    this.apiKeyHash = props.apiKeyHash;
    this.activatedAt = props.activatedAt;
    this.lastSeenAt = props.lastSeenAt;
  }
}
