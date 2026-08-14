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
  // O server só escuta em 127.0.0.1 — a fronteira de segurança real é essa,
  // não CORS. Liberado geral porque o frontend roda em origem própria
  // (dev server / protocolo do Electron) e a API usa Bearer token, não
  // cookie, então não há credencial pra vazar entre origens. Ver
  // Claude/Projetos/EasyPDV/Arquitetura e Stack.md no cofre Obsidian.
  app.enableCors();

  const port = process.env.PORT ? Number(process.env.PORT) : 4001;
  await app.listen(port, "127.0.0.1");
}

void bootstrap();
