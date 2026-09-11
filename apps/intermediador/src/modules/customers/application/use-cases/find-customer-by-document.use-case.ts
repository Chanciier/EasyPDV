import { Inject, Injectable } from "@nestjs/common";
import type { Customer } from "../../domain/entities/customer.entity.js";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../ports/customer-repository.port.js";

/** Match exato de documento — usado pelo pdv-backend nos fluxos "CPF na nota" e Vale-Troca (achar-ou-criar). Não lança se não achar: `null` é uma resposta válida ("CPF novo"), quem decide o que fazer é o chamador. */
@Injectable()
export class FindCustomerByDocumentUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort) {}

  async execute(organizationId: string, document: string): Promise<Customer | null> {
    return this.customerRepository.findByDocument(organizationId, document);
  }
}
