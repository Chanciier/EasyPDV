import { Inject, Injectable } from "@nestjs/common";
import type { UpdateCustomerInput } from "@easypdv/shared-validation";
import { CustomerNotFoundError } from "../../domain/errors.js";
import type { Customer } from "../../domain/entities/customer.entity.js";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../ports/customer-repository.port.js";

@Injectable()
export class UpdateCustomerUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort) {}

  async execute(id: string, input: UpdateCustomerInput): Promise<Customer> {
    const existing = await this.customerRepository.findById(id);
    if (!existing) {
      throw new CustomerNotFoundError(id);
    }
    return this.customerRepository.update(id, input);
  }
}
