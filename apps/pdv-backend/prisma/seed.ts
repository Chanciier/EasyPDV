import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

/**
 * Popula dados mínimos de dev local: primeiro Administrador, catálogo de
 * exemplo com tabela de preço padrão, e um depósito com estoque inicial. Em
 * produção, a identidade da loja vem do fluxo de provisionamento (ver
 * docs/ELECTRON.md) — este seed é só dev.
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

async function seedCatalog(prisma: PrismaClient): Promise<{ id: string; initialStock: number }[]> {
  const existing = await prisma.product.count();
  if (existing > 0) {
    console.log("Já existe produto — seed de catálogo ignorado.");
    return [];
  }

  const category = await prisma.category.create({ data: { name: "Mercearia" } });
  const priceList = await prisma.priceList.create({ data: { name: "Padrão", active: true } });

  const products = [
    { sku: "SKU-001", name: "Arroz 5kg", price: 24.9, barcode: "7891000000011", initialStock: 40 },
    { sku: "SKU-002", name: "Feijão 1kg", price: 8.5, barcode: "7891000000028", initialStock: 60 },
    { sku: "SKU-003", name: "Café 500g", price: 15.9, barcode: "7891000000035", initialStock: 30 },
  ];

  const created: { id: string; initialStock: number }[] = [];
  for (const p of products) {
    const product = await prisma.product.create({
      data: { sku: p.sku, name: p.name, categoryId: category.id, unit: "un" },
    });
    await prisma.barcode.create({ data: { productId: product.id, code: p.barcode } });
    await prisma.priceListItem.create({
      data: { priceListId: priceList.id, productId: product.id, price: p.price },
    });
    created.push({ id: product.id, initialStock: p.initialStock });
  }

  console.log(`Catálogo de exemplo criado: ${created.length} produtos na tabela "Padrão".`);
  return created;
}

async function seedInventory(prisma: PrismaClient, products: { id: string; initialStock: number }[]) {
  const existing = await prisma.warehouse.count();
  if (existing > 0) {
    console.log("Já existe depósito — seed de estoque ignorado.");
    return;
  }

  const warehouse = await prisma.warehouse.create({ data: { name: "Depósito Principal" } });

  for (const product of products) {
    await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          warehouseId: warehouse.id,
          productId: product.id,
          type: "entrada",
          quantity: product.initialStock,
          referenceType: "seed",
        },
      }),
      prisma.stockItem.create({
        data: { warehouseId: warehouse.id, productId: product.id, quantity: product.initialStock },
      }),
    ]);
  }

  console.log(`Depósito "Depósito Principal" criado com estoque inicial para ${products.length} produtos.`);
}

async function seedCashRegister(prisma: PrismaClient) {
  const existing = await prisma.cashRegister.count();
  if (existing > 0) {
    console.log("Já existe caixa — seed de caixa ignorado.");
    return;
  }
  await prisma.cashRegister.create({ data: { name: "Caixa 1" } });
  console.log('Caixa "Caixa 1" criado.');
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedAdmin(prisma);
    const products = await seedCatalog(prisma);
    await seedInventory(prisma, products);
    await seedCashRegister(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
