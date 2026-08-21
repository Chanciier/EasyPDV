import "reflect-metadata";
import { execFileSync } from "node:child_process";
import path from "node:path";
import * as bcrypt from "bcrypt";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { PrismaService } from "./prisma/prisma.service.js";
import { USER_VERIFICATION_GATEWAY } from "./modules/identity/application/ports/user-verification-gateway.port.js";
import type { UserVerificationGatewayPort } from "./modules/identity/application/ports/user-verification-gateway.port.js";

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
 *
 * Login único entre terminais (2026-08-21): antes de criar esse admin de
 * fallback com senha padrão conhecida, pergunta ao Intermediador (via
 * `userVerificationGateway`) se esta organização já tem um administrador
 * central — se sim, pula a criação local (o próximo login já resolve
 * central e espelha localmente, ver LoginUseCase). Na PRÁTICA isso quase
 * nunca dispara num terminal genuinamente novo (a ativação, que é o que dá
 * a apiKey necessária pra perguntar, só acontece DEPOIS deste boot — ver
 * ActivateTerminalUseCase), mas cobre um caso real: tabela `User` zerada
 * manualmente num terminal que já tinha StoreIdentity (restauração de
 * backup antigo, debug). `hasCentralAdmin()` nunca lança — `false` em
 * qualquer caso ambíguo (sem StoreIdentity, rede fora), preservando o
 * comportamento de hoje como fallback seguro.
 */
async function ensureAdminUser(prisma: PrismaService, userVerificationGateway: UserVerificationGatewayPort): Promise<void> {
  const existing = await prisma.user.count();
  if (existing > 0) return;

  if (await userVerificationGateway.hasCentralAdmin()) {
    return;
  }

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
 * Bug real, achado numa loja recém-ativada de verdade (2026-08-18):
 * `ConfirmSaleUseCase` sempre precisa de pelo menos um `Warehouse` pra debitar
 * o estoque (`warehouses[0]`, ver confirm-sale.use-case.ts) — sem nenhum,
 * NoWarehouseAvailableError bloqueia TODA venda, mesmo com produto e
 * pagamento certos. O seed de dev sempre cria "Depósito Principal", mas o
 * fluxo real de ativação de terminal (ActivateTerminalUseCase) nunca cria
 * warehouse nenhum — só StoreIdentity + sync do catálogo Bling (que também
 * não mexe em estoque). Mesmo padrão de `ensureAdminUser`: idempotente
 * (count()>0 sai sem fazer nada), roda em todo boot.
 */
async function ensureDefaultWarehouse(prisma: PrismaService): Promise<void> {
  const existing = await prisma.warehouse.count();
  if (existing > 0) return;

  await prisma.warehouse.create({ data: { name: "Depósito Principal" } });
}

/**
 * Mesmo bug do `ensureDefaultWarehouse` acima, achado do mesmo jeito — só
 * que dessa vez com `CashRegister` (2026-08-19, segundo terminal ativado de
 * verdade): `OpenCashSessionUseCase` exige um `cashRegisterId` já existente
 * (`CashRegisterNotFoundError` se não achar), e o frontend (`cash-view.tsx`)
 * desabilita o próprio botão "Abrir caixa" quando `useCashRegisters()` não
 * devolve nenhum registro — terminal recém-ativado fica com a tela de Caixa
 * inteiramente travada, bloqueando toda venda (abrir caixa é pré-requisito).
 * `ActivateTerminalUseCase` nunca criou um `CashRegister`, só o seed de dev
 * cria ("Caixa 1"). Mesmo padrão idempotente das duas funções acima.
 */
async function ensureDefaultCashRegister(prisma: PrismaService): Promise<void> {
  const existing = await prisma.cashRegister.count();
  if (existing > 0) return;

  await prisma.cashRegister.create({ data: { name: "Caixa 1" } });
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
  const prisma = app.get(PrismaService);
  const userVerificationGateway = app.get<UserVerificationGatewayPort>(USER_VERIFICATION_GATEWAY);
  await ensureAdminUser(prisma, userVerificationGateway);
  await ensureDefaultWarehouse(prisma);
  await ensureDefaultCashRegister(prisma);
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
