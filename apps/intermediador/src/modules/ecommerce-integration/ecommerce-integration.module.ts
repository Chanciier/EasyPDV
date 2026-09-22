import { Module } from "@nestjs/common";
import { ClubModule } from "../club/club.module.js";
import { EcommerceClubController } from "./infrastructure/controllers/ecommerce-club.controller.js";
import { EcommerceApiKeyGuard } from "./infrastructure/guards/ecommerce-api-key.guard.js";

@Module({
  imports: [ClubModule],
  controllers: [EcommerceClubController],
  providers: [EcommerceApiKeyGuard],
})
export class EcommerceIntegrationModule {}
