#!/usr/bin/env node
"use strict";

// Prepara resources-build/ antes de `electron-builder` empacotar — não faz
// parte do app em si (não passa por typecheck/lint do resto do monorepo).
// Ver docs/ELECTRON.md.
//
// O pdv-backend é BUNDLADO num único arquivo JS via esbuild, em vez de
// distribuído como node_modules completo (~11.600 arquivos pequenos, medido
// causando instalação de vários minutos no PC da loja — o gargalo real é a
// CONTAGEM de arquivos, não o volume em MB, confirmado com o NTFS/NSIS
// gastando a maior parte do tempo em overhead por arquivo). Só ~350 arquivos
// não podem ser bundlados (binários nativos): @prisma/client + o Prisma
// Client gerado (engine nativo), a CLI do prisma (usada em runtime pra
// `migrate deploy` no boot) e bcrypt (addon nativo).

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const ELECTRON_DIR = path.join(__dirname, "..");
const ROOT = path.join(ELECTRON_DIR, "..", "..");
const BACKEND_SRC = path.join(ROOT, "apps", "pdv-backend");
const BACKEND_TARGET = path.join(ELECTRON_DIR, "resources-build", "pdv-backend");
const FRONTEND_SOURCE = path.join(ROOT, "apps", "pdv-frontend", "out");
const FRONTEND_TARGET = path.join(ELECTRON_DIR, "resources-build", "pdv-frontend");

// Pacotes que precisam continuar como node_modules reais (não bundlados) —
// cada um tem um motivo específico, ver copyExternalPackages() abaixo.
const EXTERNAL_PACKAGES = ["@prisma/client", "prisma", "bcrypt"];

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

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countFiles(full);
    else count += 1;
  }
  return count;
}

/**
 * Resolve o diretório real de um pacote a partir de onde o pdv-backend o
 * importa — sobe a árvore de `node_modules` manualmente, exatamente como o
 * algoritmo de resolução de pacotes do Node faz, mas sem passar pela etapa
 * de resolver um ARQUIVO específico dentro do pacote.
 *
 * Deliberadamente não usa `require.resolve(pkgName, ...)` nem
 * `require.resolve(pkgName + "/package.json", ...)` — ambos dependem do
 * campo "exports" do package.json, que se mostrou uma fonte real de bugs
 * aqui: `@prisma/debug` bloqueia o subpath "./package.json" mesmo o
 * arquivo existindo no disco ("not defined by exports"), e `prisma` tem uma
 * condição "types" no mapa de exports que o Node prioriza incorretamente
 * pra uma resolução sem subpath, apontando pra um arquivo que não é o
 * entry point real. Achar o DIRETÓRIO de um pacote não deveria depender de
 * "exports" (que existe pra resolver arquivos, não pastas) — só precisa
 * confirmar que `node_modules/<pkg>/package.json` existe fisicamente.
 */
function resolvePackageDir(pkgName, fromDir) {
  const segments = pkgName.split("/"); // suporta pacotes com escopo (@org/nome)
  let dir = path.resolve(fromDir);
  while (true) {
    // Pula quando dir já É uma pasta "node_modules" (ex: subindo a partir
    // de .../@prisma+engines@6.19.3/node_modules/@prisma/engines) — sem
    // isso o candidato duplicaria ".../node_modules/node_modules/...",
    // que nunca existe. Replica o algoritmo real de _nodeModulePaths do
    // Node, que pula esses níveis pelo mesmo motivo.
    if (path.basename(dir) !== "node_modules") {
      const candidate = path.join(dir, "node_modules", ...segments);
      if (fs.existsSync(path.join(candidate, "package.json"))) {
        return fs.realpathSync(candidate);
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`Pacote "${pkgName}" não encontrado subindo a partir de ${fromDir}`);
    dir = parent;
  }
}

/**
 * Resolve recursivamente as dependências (dependencies + optionalDependencies
 * declaradas) de um pacote, retornando um Map nome -> diretório real. Um
 * pacote external "autocontido" é a exceção, não a regra — descoberto rodando
 * de verdade: `bcrypt` faz `require("@mapbox/node-pre-gyp")` incondicionalmente
 * no topo do arquivo (só pra localizar o binário .node, mas o require já
 * falha antes disso se o pacote não existir fisicamente), e esse por sua vez
 * tem sua própria árvore de dependências (tar, rimraf, nopt, npmlog...).
 * Resolve cada uma a partir do diretório da PRÓPRIA dependência (não do
 * pdv-backend), igual o algoritmo de resolução de módulos do Node faz.
 */
function collectTransitiveDeps(pkgDir, collected = new Map()) {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  const deps = { ...pkgJson.dependencies, ...pkgJson.optionalDependencies };
  for (const depName of Object.keys(deps)) {
    if (collected.has(depName)) continue;
    let depDir;
    try {
      depDir = resolvePackageDir(depName, pkgDir);
    } catch {
      continue; // optionalDependency genuinamente não instalada — ok
    }
    collected.set(depName, depDir);
    collectTransitiveDeps(depDir, collected);
  }
  return collected;
}

/**
 * Copia os poucos pacotes que ficam de fora do bundle, mais tudo que eles
 * precisam em runtime. `dereference: true` porque o pnpm resolve deps via
 * symlink dentro do virtual store — copiar o conteúdo real em vez do link
 * evita qualquer link quebrado no destino, ao custo de duplicar alguns
 * bytes (irrelevante nessa escala, poucas centenas de arquivos no total).
 */
function copyExternalPackages(target) {
  const nodeModulesTarget = path.join(target, "node_modules");
  fs.mkdirSync(nodeModulesTarget, { recursive: true });

  const toCopy = new Map();
  for (const pkg of EXTERNAL_PACKAGES) {
    toCopy.set(pkg, resolvePackageDir(pkg, BACKEND_SRC));
  }
  for (const dir of [...toCopy.values()]) {
    collectTransitiveDeps(dir, toCopy);
  }

  for (const [pkg, srcDir] of toCopy) {
    const destDir = path.join(nodeModulesTarget, pkg);
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    fs.cpSync(srcDir, destDir, { recursive: true, dereference: true });
  }
  console.log(`   ${toCopy.size} pacotes externos copiados (com dependências transitivas resolvidas)`);

  // `.prisma/client` (o Prisma Client gerado de verdade, com o engine
  // nativo) mora como irmão de `@prisma/client` no mesmo node_modules, não
  // como uma dependência própria resolvível por nome — output padrão do
  // `prisma generate` sem output customizado (ver schema.prisma).
  const prismaClientPkgDir = resolvePackageDir("@prisma/client", BACKEND_SRC);
  const nodeModulesContainingIt = path.dirname(path.dirname(prismaClientPkgDir)); // sobe @prisma/, depois node_modules/
  const dotPrismaSrc = path.join(nodeModulesContainingIt, ".prisma", "client");
  if (!fs.existsSync(dotPrismaSrc)) {
    console.error(`Prisma Client gerado não encontrado em ${dotPrismaSrc} — rode "prisma generate" primeiro.`);
    process.exit(1);
  }
  fs.cpSync(dotPrismaSrc, path.join(nodeModulesTarget, ".prisma", "client"), {
    recursive: true,
    dereference: true,
  });
}

async function main() {
console.log("== 1/6: build do pdv-backend (tsc via nest build) ==");
run("pnpm", ["--filter", "@easypdv/pdv-backend", "build"], ROOT);

console.log("\n== 2/6: gera o Prisma Client (engine nativo da plataforma atual) ==");
run("pnpm", ["--filter", "@easypdv/pdv-backend", "run", "prisma:generate"], ROOT);

/**
 * @nestjs/core faz `require()` internamente de vários transports opcionais
 * de microservices que este projeto nunca instalou (@nestjs/microservices,
 * ioredis, amqplib, mqtt, kafkajs...) — sempre dentro de `loadPackage()`,
 * um helper do próprio Nest que faz try/catch e degrada graciosamente se o
 * pacote não existir (já é assim hoje, sem bundling). O esbuild, ao montar
 * o bundle, tenta resolver esses requires estaticamente e falha porque eles
 * genuinamente não estão instalados — listar cada um à mão seria frágil
 * (quebra a cada versão nova do Nest que adicionar um transport). Em vez
 * disso, qualquer pacote (não-relativo) que o Node não consegue resolver no
 * disco vira external automaticamente — o require original fica intacto no
 * bundle, e só falharia em runtime se fosse de fato chamado, o que o
 * try/catch do Nest já impede.
 */
const optionalPeerDepsExternalPlugin = {
  name: "optional-peer-deps-external",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.path.startsWith(".") || path.isAbsolute(args.path)) return null;
      try {
        require.resolve(args.path, { paths: [args.resolveDir] });
        return null;
      } catch {
        return { path: args.path, external: true };
      }
    });
  },
};

console.log("\n== 3/6: empacota o backend num único arquivo (esbuild) ==");
rmrf(BACKEND_TARGET);
fs.mkdirSync(path.join(BACKEND_TARGET, "dist"), { recursive: true });
await esbuild.build({
  entryPoints: [path.join(BACKEND_SRC, "dist", "main.js")],
  outfile: path.join(BACKEND_TARGET, "dist", "main.js"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  // Externals: binários nativos (bcrypt, o engine do Prisma) e a CLI do
  // Prisma, que o boot chama via require.resolve("prisma/package.json")
  // (ver src/main.ts, runMigrations()) — esbuild não segue chamadas
  // dinâmicas de require.resolve mesmo sem essa lista, mas listar deixa a
  // intenção explícita e evita o bundler tentar (e falhar) analisar os
  // binários .node dentro desses pacotes.
  external: [...EXTERNAL_PACKAGES, ".prisma/client"],
  plugins: [optionalPeerDepsExternalPlugin],
  logLevel: "warning",
});

console.log("\n== 4/6: copia os pacotes que não bundlam (Prisma, bcrypt) ==");
copyExternalPackages(BACKEND_TARGET);

console.log("\n== 5/6: copia prisma/ (schema + migrations, sem dev.db/.env) ==");
fs.mkdirSync(path.join(BACKEND_TARGET, "prisma"), { recursive: true });
fs.cpSync(path.join(BACKEND_SRC, "prisma", "schema.prisma"), path.join(BACKEND_TARGET, "prisma", "schema.prisma"));
fs.cpSync(path.join(BACKEND_SRC, "prisma", "migrations"), path.join(BACKEND_TARGET, "prisma", "migrations"), {
  recursive: true,
});

const totalFiles = countFiles(BACKEND_TARGET);
console.log(`   backend empacotado: ${totalFiles} arquivos (era ~11.600 antes do bundling)`);

console.log("\n== 6/6: copia o export estático do pdv-frontend ==");
if (!fs.existsSync(FRONTEND_SOURCE)) {
  console.error(
    `Export estático do pdv-frontend não encontrado em ${FRONTEND_SOURCE} — rode "pnpm --filter @easypdv/pdv-frontend build" primeiro.`,
  );
  process.exit(1);
}
rmrf(FRONTEND_TARGET);
fs.cpSync(FRONTEND_SOURCE, FRONTEND_TARGET, { recursive: true });

console.log("\nRecursos preparados em resources-build/.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
