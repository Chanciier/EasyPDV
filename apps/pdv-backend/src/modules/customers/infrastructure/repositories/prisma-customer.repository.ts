import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service.js";
import { Customer } from "../../domain/entities/customer.entity.js";
import type {
  CreateCustomerData,
  CustomerRepositoryPort,
  UpdateCustomerData,
} from "../../application/ports/customer-repository.port.js";
import { toDomainCustomer } from "../mappers/customers.mapper.js";

@Injectable()
export class PrismaCustomerRepository implements CustomerRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Customer | null> {
    const record = await this.prisma.customer.findUnique({ where: { id } });
    return record ? toDomainCustomer(record) : null;
  }

  async search(query?: string): Promise<Customer[]> {
    const records = await this.prisma.customer.findMany({
      where: query
        ? { OR: [{ name: { contains: query } }, { document: { contains: query } }] }
        : undefined,
      orderBy: { name: "asc" },
      take: 25,
    });
    return records.map(toDomainCustomer);
  }

  async create(data: CreateCustomerData): Promise<Customer> {
    const record = await this.prisma.customer.create({ data });
    return toDomainCustomer(record);
  }

  async update(id: string, data: UpdateCustomerData): Promise<Customer> {
    const record = await this.prisma.customer.update({ where: { id }, data });
    return toDomainCustomer(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.customer.delete({ where: { id } });
  }
}
