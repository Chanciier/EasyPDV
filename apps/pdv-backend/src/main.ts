import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";

/**
 * Backend local do PDV. Sobe em localhost, chamado pelo renderer do Electron.
 * Nunca deve depender de rede externa para responder — ver
 * Claude/Projetos/EasyPDV/Arquitetura e Stack.md no cofre Obsidian.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const port = process.env.PORT ? Number(process.env.PORT) : 4001;
  await app.listen(port, "127.0.0.1");
}

void bootstrap();
