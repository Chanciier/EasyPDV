import { Inject, Injectable } from "@nestjs/common";
import { onlyDigits, formatCpf } from "@easypdv/shared-validation";
import { SaleNotEditableError, SaleNotFoundError } from "../../domain/errors.js";
import type { Sale } from "../../domain/entities/sale.entity.js";
import { SALE_REPOSITORY, type SaleRepositoryPort } from "../ports/sale-repository.port.js";
import { CUSTOMER_REPOSITORY, type CustomerRepositoryPort } from "../../../customers/application/ports/customer-repository.port.js";

/**
 * "CPF na nota" (2026-08-19) — busca ou cria o `Customer` pelo documento e
 * anexa na venda em andamento. Documento sempre normalizado pra só dígitos
 * antes de buscar/gravar (o operador pode digitar formatado ou não — precisa
 * de UMA representação canônica pra `findByDocument`/`@unique` funcionarem).
 * Nome é opcional (convenção de balcão: cliente geralmente só informa o
 * CPF) — default vira "Consumidor CPF {cpf formatado}" quando ausente,
 * pra nunca aparecer um nome vazio/estranho numa tela de gestão de
 * clientes futura.
 */
@Injectable()
export class AttachCustomerToSaleUseCase {
  constructor(
    @Inject(SALE_REPOSITORY) private readonly saleRepository: SaleRepositoryPort,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepositoryPort,
  ) {}

  async execute(saleId: string, document: string, name: string | null): Promise<Sale> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new SaleNotFoundError(saleId);
    }
    if (!sale.canBeModified) {
      throw new SaleNotEditableError(saleId);
    }

    const normalizedDocument = onlyDigits(document);
    let customer = await this.customerRepository.findByDocument(normalizedDocument);
    if (!customer) {
      customer = await this.customerRepository.create({
        name: name ?? `Consumidor CPF ${formatCpf(normalizedDocument)}`,
        document: normalizedDocument,
        phone: null,
        email: null,
      });
    }

    return this.saleRepository.attachCustomer(saleId, customer.id);
  }
}
