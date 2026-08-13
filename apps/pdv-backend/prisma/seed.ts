import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

/**
 * Popula dados mínimos de dev local: primeiro Administrador + um catálogo de
 * exemplo com tabela de preço padrão. Em produção, a identidade da loja vem
 * do fluxo de provisionamento (ver docs/ELECTRON.md) — este seed é só dev.
 */
async function seedAdmin(prisma: PrismaClient) {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log("Já existe usuário — seed de admin ignorado.");
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@easypdv.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "troque-esta-senha";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: { name: "Administrador", email, passwordHash, role: "administrador" },
  });
  console.log(`Administrador criado: ${email}`);
}

async function seedCatalog(prisma: PrismaClient) {
  const existing = await prisma.product.count();
  if (existing > 0) {
    console.log("Já existe produto — seed de catálogo ignorado.");
    return;
  }

  const category = await prisma.category.create({ data: { name: "Mercearia" } });
  const priceList = await prisma.priceList.create({ data: { name: "Padrão", active: true } });

  const products = [
    { sku: "SKU-001", name: "Arroz 5kg", price: 24.9, barcode: "7891000000011" },
    { sku: "SKU-002", name: "Feijão 1kg", price: 8.5, barcode: "7891000000028" },
    { sku: "SKU-003", name: "Café 500g", price: 15.9, barcode: "7891000000035" },
  ];

  for (const p of products) {
    const product = await prisma.product.create({
      data: { sku: p.sku, name: p.name, categoryId: category.id, unit: "un" },
    });
    await prisma.barcode.create({ data: { productId: product.id, code: p.barcode } });
    await prisma.priceListItem.create({
      data: { priceListId: priceList.id, productId: product.id, price: p.price },
    });
  }

  console.log(`Catálogo de exemplo criado: ${products.length} produtos na tabela "Padrão".`);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedAdmin(prisma);
    await seedCatalog(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
