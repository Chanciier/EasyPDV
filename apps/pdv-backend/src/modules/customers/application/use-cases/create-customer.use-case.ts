import { Inject, Injectable } from "@nestjs/common";
import type { CreateCustomerInput } from "@easypdv/shared-validation";
import type { Customer } from "../../domain/entities/customer.entity.js";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../ports/customer-repository.port.js";

@Injectable()
export class CreateCustomerUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort) {}

  async execute(input: CreateCustomerInput): Promise<Customer> {
    return this.customerRepository.create({
      name: input.name,
      document: input.document ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
    });
  }
}
