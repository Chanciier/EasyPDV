import { Module } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway.js";

@Module({
  providers: [RealtimeGateway],
  // Consumido por SalesController (Sprint 13) pra emitir sale.confirmed e
  // cash_session.opened/closed logo após a mutação ter sucesso — broadcast é
  // efeito de apresentação, não de domínio, por isso é chamado do controller
  // e não do use-case (ver ConfirmSaleUseCase).
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
