import "reflect-metadata";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";

/**
 * Aplica migrations pendentes contra o DATABASE_URL atual antes de subir o
 * Nest — mesmo padrão do pdv-backend (ver apps/pdv-backend/src/main.ts).
 * Sem isso, o deploy no Railway nunca migra o Postgres sozinho (achado só
 * agora: `SyncJob`/`ErpIntegration` nunca existiram na tabela de produção,
 * só as tabelas criadas manualmente numa sessão anterior — o Dockerfile só
 * faz `node dist/main.js`, nunca `prisma migrate deploy`). Precisa de
 * `prisma` como dependency real (não devDependency), senão o `pnpm deploy
 * --prod` do Dockerfile exclui o pacote do node_modules de produção.
 */
function runMigrations(): void {
  const prismaPkgPath = require.resolve("prisma/package.json");
  const prismaCliEntry = path.join(path.dirname(prismaPkgPath), "build", "index.js");
  const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");

  execFileSync(process.execPath, [prismaCliEntry, "migrate", "deploy", "--schema", schemaPath], {
    stdio: "inherit",
    env: process.env,
  });
}

/**
 * Intermediador — hospedado no Railway. Único ponto que fala com o Bling.
 * Recebe sincronização de todas as lojas via API; nunca é chamado pelo PDV
 * local no caminho crítico de uma venda. Ver
 * Claude/Projetos/EasyPDV/Arquitetura e Stack.md no cofre Obsidian.
 */
async function bootstrap() {
  runMigrations();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const port = process.env.PORT ? Number(process.env.PORT) : 4002;
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
