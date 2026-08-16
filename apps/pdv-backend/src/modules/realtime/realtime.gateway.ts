import { Logger } from "@nestjs/common";
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

export interface SaleConfirmedEvent {
  saleId: string;
  totalAmount: number;
  confirmedAt: string;
}

export interface SaleVoidedEvent {
  saleId: string;
  reason: string;
}

export interface CashSessionEvent {
  sessionId: string;
  cashRegisterId: string;
}

/**
 * Broadcast pra clientes conectados (Renderer do Electron, ou navegador de
 * dev) — não autenticado por design, mesma fronteira de confiança já
 * estabelecida pro resto da API (o backend só escuta em 127.0.0.1, ver
 * docs/ELECTRON.md "Segurança"; o payload em si não carrega nada que o
 * cliente não já veria via REST autenticado). É só "algo mudou, revalida" —
 * nenhum cliente depende disso pra funcionar corretamente sem ele (o polling
 * via TanStack Query já cobre o próprio tab que fez a mutação).
 */
@WebSocketGateway({ cors: { origin: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    this.logger.log(`Cliente realtime conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Cliente realtime desconectado: ${client.id}`);
  }

  emitSaleConfirmed(event: SaleConfirmedEvent): void {
    this.server.emit("sale.confirmed", event);
  }

  emitSaleVoided(event: SaleVoidedEvent): void {
    this.server.emit("sale.voided", event);
  }

  emitCashSessionOpened(event: CashSessionEvent): void {
    this.server.emit("cash_session.opened", event);
  }

  emitCashSessionClosed(event: CashSessionEvent): void {
    this.server.emit("cash_session.closed", event);
  }
}
