import type { Customer } from "../../domain/entities/customer.entity.js";

export interface CreateCustomerData {
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
}

export interface UpdateCustomerData {
  name?: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface CustomerRepositoryPort {
  findById(id: string): Promise<Customer | null>;
  /** Sem `query` devolve todos (tela de gestão); com `query`, filtra por nome/documento (autocomplete da Venda). */
  search(query?: string): Promise<Customer[]>;
  create(data: CreateCustomerData): Promise<Customer>;
  update(id: string, data: UpdateCustomerData): Promise<Customer>;
  delete(id: string): Promise<void>;
}

export const CUSTOMER_REPOSITORY = Symbol("CUSTOMER_REPOSITORY");
