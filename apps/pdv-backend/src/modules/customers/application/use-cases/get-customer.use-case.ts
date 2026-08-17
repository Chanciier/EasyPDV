import { Inject, Injectable } from "@nestjs/common";
import { CustomerNotFoundError } from "../../domain/errors.js";
import type { Customer } from "../../domain/entities/customer.entity.js";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../ports/customer-repository.port.js";

@Injectable()
export class GetCustomerUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort) {}

  async execute(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new CustomerNotFoundError(id);
    }
    return customer;
  }
}
