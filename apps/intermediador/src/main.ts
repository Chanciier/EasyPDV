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

  // CORS pro painel admin (Fase 2, 2026-09-14) — export estático do
  // pdv-frontend rodando fora do Electron (host de site estático, ver
  // "Planejamento - Lembrete de Renovação do Clube.md" no cofre Obsidian),
  // então o navegador do admin é uma origem diferente do Intermediador.
  // Segurança real fica inteira em OrgJwtAuthGuard nos endpoints — CORS aqui
  // só controla QUAIS sites o navegador deixa chamar a API, não substitui
  // autenticação. `ADMIN_PANEL_ORIGINS` (lista separada por vírgula) fica
  // vazia até o hosting do painel ser decidido; sem ela, libera geral
  // (aceitável por ora: nenhum endpoint aqui confia em cookie de sessão,
  // só em Bearer token explícito, que CORS não protege de qualquer forma).
  const adminPanelOrigins = process.env.ADMIN_PANEL_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: adminPanelOrigins && adminPanelOrigins.length > 0 ? adminPanelOrigins : true });

  const port = process.env.PORT ? Number(process.env.PORT) : 4002;
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
