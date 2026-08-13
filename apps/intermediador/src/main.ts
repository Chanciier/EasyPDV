import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";

/**
 * Intermediador — hospedado no Railway. Único ponto que fala com o Bling.
 * Recebe sincronização de todas as lojas via API; nunca é chamado pelo PDV
 * local no caminho crítico de uma venda. Ver
 * Claude/Projetos/EasyPDV/Arquitetura e Stack.md no cofre Obsidian.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const port = process.env.PORT ? Number(process.env.PORT) : 4002;
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
