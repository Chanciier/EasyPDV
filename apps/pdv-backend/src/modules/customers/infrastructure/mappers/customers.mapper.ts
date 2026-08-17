import type { Customer as PrismaCustomer } from "@prisma/client";
import { Customer } from "../../domain/entities/customer.entity.js";

export function toDomainCustomer(record: PrismaCustomer): Customer {
  return new Customer({
    id: record.id,
    name: record.name,
    document: record.document,
    phone: record.phone,
    email: record.email,
  });
}
