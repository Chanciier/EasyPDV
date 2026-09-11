import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  STORE_IDENTITY_REPOSITORY,
  type StoreIdentityRepositoryPort,
} from "../../../provisioning/application/ports/store-identity-repository.port.js";
import { Customer } from "../../domain/entities/customer.entity.js";
import type {
  CreateCustomerData,
  CustomerRepositoryPort,
  UpdateCustomerData,
} from "../../application/ports/customer-repository.port.js";
import type {
  CustomerBlingImportGatewayPort,
  ImportCustomersFromBlingResult,
} from "../../application/ports/customer-bling-import-gateway.port.js";

/**
 * Cliente centralizado (2026-09-11) — mesmo padrão de HttpStoreCreditGateway/
 * HttpClubGateway: apiKey de terminal lida do StoreIdentity local a cada
 * chamada. Implementa o MESMO CustomerRepositoryPort que PrismaCustomerRepository
 * implementava (nada muda pra quem consome o port — só a implementação por
 * trás do token CUSTOMER_REPOSITORY). Pedido direto do usuário: "eu não
 * gosto de nada local, leva tudo para o intermediador e deixa o pdv buscar
 * lá. todos os terminais precisam ser comunicaveis" — sem fallback offline
 * de propósito, mesma característica que Vale-Troca já tem desde a Fase 1.
 */
@Injectable()
export class HttpCustomerRepository implements CustomerRepositoryPort, CustomerBlingImportGatewayPort {
  private readonly baseUrl: string;

  constructor(
    configService: ConfigService,
    @Inject(STORE_IDENTITY_REPOSITORY) private readonly storeIdentityRepository: StoreIdentityRepositoryPort,
  ) {
    this.baseUrl = configService.get<string>("INTERMEDIADOR_URL") ?? "http://127.0.0.1:4002";
  }

  private async headers(): Promise<{ apiKey: string }> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      throw new Error("Terminal não ativado — sem identidade de loja pra consultar clientes.");
    }
    return { apiKey: identity.apiKey };
  }

  private toCustomer(body: unknown): Customer {
    return new Customer(body as { id: string; name: string; document: string | null; phone: string | null; email: string | null });
  }

  /**
   * `FindCustomerByDocumentUseCase` (Intermediador) devolve `null` quando o
   * CPF é novo — e o Nest/Express manda corpo VAZIO (Content-Length: 0) pra
   * um handler que retorna `null`, não a string `"null"`. `response.json()`
   * direto quebra nesse caso ("Unexpected end of JSON input") — lê como
   * texto primeiro e só faz parse se tiver conteúdo.
   */
  private async parseJsonOrNull(response: Response): Promise<unknown> {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async findById(id: string): Promise<Customer | null> {
    const { apiKey } = await this.headers();
    const response = await fetch(`${this.baseUrl}/customers/${id}`, { headers: { "X-Terminal-Api-Key": apiKey } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Intermediador respondeu ${response.status} para GET /customers/${id}`);
    const body = await this.parseJsonOrNull(response);
    return body ? this.toCustomer(body) : null;
  }

  async findByDocument(document: string): Promise<Customer | null> {
    const { apiKey } = await this.headers();
    const response = await fetch(`${this.baseUrl}/customers/by-document/${encodeURIComponent(document)}`, {
      headers: { "X-Terminal-Api-Key": apiKey },
    });
    if (!response.ok) throw new Error(`Intermediador respondeu ${response.status} para GET /customers/by-document/${document}`);
    const body = await this.parseJsonOrNull(response);
    return body ? this.toCustomer(body) : null;
  }

  async search(query?: string): Promise<Customer[]> {
    const { apiKey } = await this.headers();
    const url = new URL(`${this.baseUrl}/customers`);
    if (query) url.searchParams.set("query", query);
    const response = await fetch(url, { headers: { "X-Terminal-Api-Key": apiKey } });
    if (!response.ok) throw new Error(`Intermediador respondeu ${response.status} para GET /customers`);
    const body = (await response.json()) as unknown[];
    return body.map((item) => this.toCustomer(item));
  }

  async create(data: CreateCustomerData): Promise<Customer> {
    const { apiKey } = await this.headers();
    // createCustomerSchema (Intermediador) espera phone/document/email
    // AUSENTES quando não informados (`.optional()`, sem `.nullable()` —
    // diferente de updateCustomerSchema, que aceita `null` pra limpar um
    // campo já existente). CreateCustomerData usa `null` internamente
    // (convenção do domínio local); precisa virar `undefined` (chave
    // omitida no JSON) antes de cruzar a fronteira HTTP.
    const body = {
      name: data.name,
      document: data.document ?? undefined,
      phone: data.phone ?? undefined,
      email: data.email ?? undefined,
    };
    const response = await fetch(`${this.baseUrl}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Terminal-Api-Key": apiKey },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `Intermediador respondeu ${response.status} para POST /customers`);
    }
    return this.toCustomer(await response.json());
  }

  async update(id: string, data: UpdateCustomerData): Promise<Customer> {
    const { apiKey } = await this.headers();
    const response = await fetch(`${this.baseUrl}/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Terminal-Api-Key": apiKey },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `Intermediador respondeu ${response.status} para PATCH /customers/${id}`);
    }
    return this.toCustomer(await response.json());
  }

  async delete(id: string): Promise<void> {
    const { apiKey } = await this.headers();
    const response = await fetch(`${this.baseUrl}/customers/${id}`, {
      method: "DELETE",
      headers: { "X-Terminal-Api-Key": apiKey },
    });
    if (!response.ok) throw new Error(`Intermediador respondeu ${response.status} para DELETE /customers/${id}`);
  }

  /**
   * Pagina o cadastro inteiro do Bling do lado do Intermediador (uma
   * chamada de detalhe por contato com documento, rate-limited) — pode
   * levar dezenas de segundos com um cadastro grande. Timeout bem mais
   * folgado que os outros métodos desta classe, de propósito.
   */
  async importFromBling(): Promise<ImportCustomersFromBlingResult> {
    const { apiKey } = await this.headers();
    const response = await fetch(`${this.baseUrl}/customers/import-from-bling`, {
      method: "POST",
      headers: { "X-Terminal-Api-Key": apiKey },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `Intermediador respondeu ${response.status} para POST /customers/import-from-bling`);
    }
    return (await response.json()) as ImportCustomersFromBlingResult;
  }
}
