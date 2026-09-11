import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { Customer } from "../../domain/entities/customer.entity.js";
import type {
  CreateCustomerData,
  CustomerRepositoryPort,
  UpdateCustomerData,
} from "../../application/ports/customer-repository.port.js";

function toDomain(record: {
  id: string;
  organizationId: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Customer {
  return new Customer(record);
}

@Injectable()
export class PrismaCustomerRepository implements CustomerRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(organizationId: string, id: string): Promise<Customer | null> {
    const record = await this.prisma.customer.findFirst({ where: { id, organizationId } });
    return record ? toDomain(record) : null;
  }

  async findByDocument(organizationId: string, document: string): Promise<Customer | null> {
    const record = await this.prisma.customer.findUnique({
      where: { organizationId_document: { organizationId, document } },
    });
    return record ? toDomain(record) : null;
  }

  async search(organizationId: string, query?: string): Promise<Customer[]> {
    const records = await this.prisma.customer.findMany({
      where: {
        organizationId,
        ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { document: { contains: query } }] } : {}),
      },
      orderBy: { name: "asc" },
      take: 25,
    });
    return records.map(toDomain);
  }

  async create(data: CreateCustomerData): Promise<Customer> {
    const record = await this.prisma.customer.create({ data });
    return toDomain(record);
  }

  async update(organizationId: string, id: string, data: UpdateCustomerData): Promise<Customer> {
    const record = await this.prisma.customer.update({ where: { id, organizationId }, data });
    return toDomain(record);
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.prisma.customer.delete({ where: { id, organizationId } });
  }
}
