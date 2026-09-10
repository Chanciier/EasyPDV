import { Inject, Injectable } from "@nestjs/common";
import { onlyDigits } from "@easypdv/shared-validation";
import type { Customer } from "../../../customers/domain/entities/customer.entity.js";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../../../customers/application/ports/customer-repository.port.js";

/**
 * `GET /store-credit/customer/:document` — resolve se o CPF já tem
 * `Customer` local ANTES de bipar qualquer item, pra tela decidir se pede
 * nome+telefone (CPF novo) ou segue direto (CPF já cadastrado). Match exato
 * por documento, mesmo repositório que AttachCustomerToSaleUseCase usa —
 * não cria nada aqui, só consulta (a criação acontece em GrantStoreCreditUseCase,
 * junto com a geração do crédito, nunca antes/sem crédito nenhum).
 */
@Injectable()
export class FindStoreCreditCustomerUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort) {}

  async execute(document: string): Promise<Customer | null> {
    return this.customerRepository.findByDocument(onlyDigits(document));
  }
}
