import { Inject, Injectable } from "@nestjs/common";
import { CustomerNotFoundError } from "../../domain/errors.js";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../ports/customer-repository.port.js";

@Injectable()
export class DeleteCustomerUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort) {}

  async execute(id: string): Promise<void> {
    const existing = await this.customerRepository.findById(id);
    if (!existing) {
      throw new CustomerNotFoundError(id);
    }
    await this.customerRepository.delete(id);
  }
}
