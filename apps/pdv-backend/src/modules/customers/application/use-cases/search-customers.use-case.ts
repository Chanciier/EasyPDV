import { Inject, Injectable } from "@nestjs/common";
import type { Customer } from "../../domain/entities/customer.entity.js";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../ports/customer-repository.port.js";

@Injectable()
export class SearchCustomersUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort) {}

  async execute(query?: string): Promise<Customer[]> {
    return this.customerRepository.search(query);
  }
}
