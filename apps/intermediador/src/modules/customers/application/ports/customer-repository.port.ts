import type { Customer } from "../../domain/entities/customer.entity.js";

export interface CreateCustomerData {
  organizationId: string;
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

/**
 * Cliente centralizado (2026-09-11) — mesmo formato do CustomerRepositoryPort
 * do pdv-backend (findById/findByDocument/search/create/update/delete), só
 * que escopado por organização em vez de instância local. O pdv-backend
 * troca a implementação por trás do MESMO port local por um gateway HTTP
 * pra cá — nenhum dos consumidores de lá muda.
 */
export interface CustomerRepositoryPort {
  findById(organizationId: string, id: string): Promise<Customer | null>;
  /** Match exato de `document`, escopado à organização. */
  findByDocument(organizationId: string, document: string): Promise<Customer | null>;
  /** Sem `query` devolve todos da organização; com `query`, filtra por nome/documento. */
  search(organizationId: string, query?: string): Promise<Customer[]>;
  create(data: CreateCustomerData): Promise<Customer>;
  update(organizationId: string, id: string, data: UpdateCustomerData): Promise<Customer>;
  delete(organizationId: string, id: string): Promise<void>;
}

export const CUSTOMER_REPOSITORY = Symbol("CUSTOMER_REPOSITORY");
