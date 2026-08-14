import { PrismaClient } from "../src/generated/prisma/index.js";

/**
 * Popula uma Organization + Store única de dev local — serve de
 * `organizationId` pra testar a conexão OAuth com o Bling (Sprint 7).
 * Provisionamento real de organização/loja é fora do escopo da V1 local
 * (fluxo de ativação de terminal, ver docs/ROADMAP.md).
 */
async function seedOrganization(prisma: PrismaClient) {
  const existing = await prisma.organization.count();
  if (existing > 0) {
    console.log("Já existe organização — seed ignorado.");
    return;
  }

  const organization = await prisma.organization.create({
    data: { name: "EasyPDV Dev" },
  });
  await prisma.store.create({
    data: { organizationId: organization.id, name: "Loja Dev" },
  });

  console.log(`Organization "${organization.name}" criada: ${organization.id}`);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedOrganization(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
