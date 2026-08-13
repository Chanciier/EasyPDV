import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

/**
 * Cria o primeiro Administrador em dev local, se ainda não existir nenhum
 * usuário. Em produção, a identidade da loja/terminal vem do fluxo de
 * provisionamento (ver docs/ELECTRON.md) — este seed é só para desenvolvimento.
 */
async function main() {
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.count();
    if (existing > 0) {
      console.log("Já existe usuário — seed ignorado.");
      return;
    }

    const email = process.env.SEED_ADMIN_EMAIL ?? "admin@easypdv.local";
    const password = process.env.SEED_ADMIN_PASSWORD ?? "troque-esta-senha";
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name: "Administrador",
        email,
        passwordHash,
        role: "administrador",
      },
    });

    console.log(`Administrador criado: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
