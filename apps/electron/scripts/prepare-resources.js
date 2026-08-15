#!/usr/bin/env node
"use strict";

// Prepara resources-build/ antes de `electron-builder` empacotar — não faz
// parte do app em si (não passa por typecheck/lint do resto do monorepo).
// Ver docs/ELECTRON.md.

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ELECTRON_DIR = path.join(__dirname, "..");
const ROOT = path.join(ELECTRON_DIR, "..", "..");
const BACKEND_TARGET = path.join(ELECTRON_DIR, "resources-build", "pdv-backend");
const FRONTEND_SOURCE = path.join(ROOT, "apps", "pdv-frontend", "out");
const FRONTEND_TARGET = path.join(ELECTRON_DIR, "resources-build", "pdv-frontend");

// shell:true é necessário no Windows pra rodar pnpm/npx (shims .cmd) —
// spawnSync direto do .cmd falha com EINVAL sem shell (limitação conhecida
// do Node no Windows). Seguro aqui porque todo argumento é literal montado
// por este script (caminhos calculados acima), nunca entrada externa/usuário.
function run(command, args, cwd) {
  console.log(`$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

console.log("== 1/4: build do pdv-backend ==");
run("pnpm", ["--filter", "@easypdv/pdv-backend", "build"], ROOT);

// pnpm deploy monta um node_modules autocontido, sem symlink do pnpm store —
// necessário porque o processo filho que o Electron spawna resolve módulo
// Node padrão, não entende o link simbólico do monorepo. Ver docs/ELECTRON.md.
console.log("\n== 2/4: pnpm deploy do pdv-backend (node_modules autocontido) ==");
rmrf(BACKEND_TARGET);
run("pnpm", ["--filter", "@easypdv/pdv-backend", "deploy", "--prod", "--legacy", BACKEND_TARGET], ROOT);

// `pnpm deploy` não roda o postinstall que geraria o Prisma Client — precisa
// rodar `prisma generate` de novo dentro do bundle deployado pra sair com o
// engine nativo da plataforma atual.
console.log("\n== 3/4: gera Prisma Client dentro do bundle ==");
run("npx", ["prisma", "generate", "--schema", path.join(BACKEND_TARGET, "prisma", "schema.prisma")], BACKEND_TARGET);

// Remove artefatos de dev que não devem ir pro instalador: banco SQLite local
// (uma instalação nova não pode nascer com dados de outra loja) e .env (o
// Electron injeta DATABASE_URL/PORT explicitamente no spawn — não depende do
// .env, e não faz sentido embarcar valor de dev no instalador).
rmrf(path.join(BACKEND_TARGET, "prisma", "dev.db"));
rmrf(path.join(BACKEND_TARGET, ".env"));

console.log("\n== 4/4: copia o export estático do pdv-frontend ==");
if (!fs.existsSync(FRONTEND_SOURCE)) {
  console.error(
    `Export estático do pdv-frontend não encontrado em ${FRONTEND_SOURCE} — rode "pnpm --filter @easypdv/pdv-frontend build" primeiro.`,
  );
  process.exit(1);
}
rmrf(FRONTEND_TARGET);
fs.cpSync(FRONTEND_SOURCE, FRONTEND_TARGET, { recursive: true });

console.log("\nRecursos preparados em resources-build/.");
