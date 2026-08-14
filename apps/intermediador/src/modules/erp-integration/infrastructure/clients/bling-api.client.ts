import { Injectable, Logger } from "@nestjs/common";

const BASE_URL = "https://api.bling.com.br/Api/v3";

export interface BlingProduct {
  id: number;
  codigo: string;
  nome: string;
}

export interface BlingContact {
  id: number;
  nome: string;
}

export interface CreateSalesOrderItem {
  produtoId: number;
  quantidade: number;
  valor: number;
  descricao: string;
}

export interface CreateSalesOrderInput {
  contatoId: number;
  formaPagamentoId: number;
  totalAmount: number;
  dueDate: string;
  items: CreateSalesOrderItem[];
}

export interface CreateSalesOrderResult {
  externalId: string;
}

interface BlingListEnvelope<T> {
  data?: T[];
}

interface BlingItemEnvelope<T> {
  data?: T;
}

interface BlingErrorEnvelope {
  error?: { message?: string; description?: unknown };
}

/**
 * Cliente HTTP de baixo nível pra api.bling.com.br/Api/v3. GET /produtos e
 * /contatos confirmados contra a API real na Sprint 7. Bling não expõe
 * endpoint de listagem de formas de pagamento — o id usado em
 * createSalesOrder vem de config (BLING_DEFAULT_PAYMENT_METHOD_ID), não de
 * lookup dinâmico. Ver BlingSyncTargetAdapter.
 */
@Injectable()
export class BlingApiClient {
  private readonly logger = new Logger(BlingApiClient.name);

  async findProductByCode(accessToken: string, codigo: string): Promise<BlingProduct | null> {
    const result = await this.request<BlingListEnvelope<BlingProduct>>(accessToken, "GET", `/produtos?codigo=${encodeURIComponent(codigo)}`);
    return result.data?.[0] ?? null;
  }

  async findContactByName(accessToken: string, nome: string): Promise<BlingContact | null> {
    const result = await this.request<BlingListEnvelope<BlingContact>>(accessToken, "GET", `/contatos?pesquisa=${encodeURIComponent(nome)}`);
    return result.data?.find((contact) => contact.nome === nome) ?? result.data?.[0] ?? null;
  }

  async createContact(accessToken: string, nome: string): Promise<BlingContact> {
    const result = await this.request<BlingItemEnvelope<BlingContact>>(accessToken, "POST", "/contatos", { nome, tipo: "F" });
    if (!result.data) {
      throw new Error(`Bling não retornou o contato criado: ${JSON.stringify(result)}`);
    }
    return result.data;
  }

  async createSalesOrder(accessToken: string, input: CreateSalesOrderInput): Promise<CreateSalesOrderResult> {
    const body = {
      data: input.dueDate,
      contato: { id: input.contatoId },
      itens: input.items.map((item) => ({
        produto: { id: item.produtoId },
        quantidade: item.quantidade,
        valor: item.valor,
        descricao: item.descricao,
      })),
      parcelas: [
        {
          dataVencimento: input.dueDate,
          valor: input.totalAmount,
          formaPagamento: { id: input.formaPagamentoId },
        },
      ],
    };

    const result = await this.request<BlingItemEnvelope<{ id: number }>>(accessToken, "POST", "/pedidos/vendas", body);
    if (!result.data?.id) {
      throw new Error(`Bling não retornou o id do pedido criado: ${JSON.stringify(result)}`);
    }
    return { externalId: String(result.data.id) };
  }

  private async request<T>(accessToken: string, method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const parsed = (await response.json().catch(() => null)) as (T & BlingErrorEnvelope) | null;
    if (!response.ok) {
      const message = parsed?.error?.message ?? JSON.stringify(parsed);
      this.logger.error(`Bling API ${method} ${path} falhou (HTTP ${response.status}): ${message}`);
      throw new Error(`Bling API ${method} ${path} falhou (HTTP ${response.status}): ${message}`);
    }
    return (parsed ?? ({} as T)) as T;
  }
}
