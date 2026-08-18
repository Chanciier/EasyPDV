import "reflect-metadata";
import { execFileSync } from "node:child_process";
import path from "node:path";
import * as bcrypt from "bcrypt";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { PrismaService } from "./prisma/prisma.service.js";

/**
 * Aplica migrations pendentes contra o DATABASE_URL atual antes de subir o
 * Nest. Idempotente (não faz nada se já estiver em dia) — roda em todo boot,
 * dev ou empacotado, de propósito: o instalador do Electron não roda
 * `prisma migrate dev` manualmente em cada loja, então cada instalação
 * precisa se automigrar sozinha (primeiro boot, ou quando uma versão nova do
 * app traz uma migration nova). Resolve o binário da CLI do Prisma via
 * `require.resolve` (build alvo é CommonJS, ver @easypdv/tsconfig/nestjs.json
 * — __dirname/require são globais nativos aqui, sem precisar de
 * createRequire/import.meta) — funciona tanto no monorepo (pnpm com
 * symlinks) quanto num bundle "achatado" por `pnpm deploy` (ver
 * docs/ELECTRON.md), já que os dois são só resolução de módulo Node padrão.
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
 * Um install novo (fora de dev) não roda `prisma db seed` — esse script é só
 * fixture de dev (catálogo/depósito/caixa de exemplo, ver prisma/seed.ts) e
 * não deveria ir pra produção. Mas sem NENHUM usuário, ninguém consegue
 * logar — não existe fluxo de "criar conta" ainda. Então só a parte do admin
 * roda aqui, sempre (idempotente — count()>0 sai sem fazer nada), direto
 * contra o PrismaService do próprio Nest (não abre uma segunda conexão).
 * SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD com o mesmo default do seed de dev —
 * troca de senha no primeiro login ainda não existe, risco aberto conhecido
 * (ver Claude/Projetos/EasyPDV/Decisões e Riscos Abertos.md no cofre Obsidian).
 */
async function ensureAdminUser(prisma: PrismaService): Promise<void> {
  const existing = await prisma.user.count();
  if (existing > 0) return;

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@easypdv.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "troque-esta-senha";
  const passwordHash = await bcrypt.hash(password, 12);
  // employeeCode 1 — count()>0 já garantiu acima que não existe nenhum usuário
  // ainda, então este é sempre o primeiro.
  await prisma.user.create({
    data: { name: "Administrador", email, passwordHash, role: "administrador", employeeCode: 1 },
  });
}

/**
 * Backend local do PDV. Sobe em localhost, chamado pelo renderer do Electron.
 * Nunca deve depender de rede externa para responder — ver
 * Claude/Projetos/EasyPDV/Arquitetura e Stack.md no cofre Obsidian.
 */
async function bootstrap() {
  runMigrations();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await ensureAdminUser(app.get(PrismaService));
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
