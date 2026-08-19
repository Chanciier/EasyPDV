import { Injectable, Logger } from "@nestjs/common";

const BASE_URL = "https://api.bling.com.br/Api/v3";

export interface BlingProduct {
  id: number;
  codigo: string;
  nome: string;
}

export interface BlingProductListItem extends BlingProduct {
  preco?: number;
  situacao?: string;
  /** `saldoVirtualTotal` é o saldo que o Bling exibe na listagem de Produtos (confirmado contra a interface pública da API v3). */
  estoque?: { saldoVirtualTotal?: number };
}

export interface BlingContact {
  id: number;
  nome: string;
}

/**
 * `tipoPagamento` (documentado na API v3): 1 Dinheiro, 2 Cheque, 3 Cartão de
 * Crédito, 4 Cartão de Débito, 15 Boleto, 17 PIX dinâmico, 20 PIX estático,
 * 99 Outros. `padrao: 1` marca a forma padrão da conta. `situacao: 1` = ativa.
 */
export interface BlingPaymentMethod {
  id: number;
  descricao: string;
  tipoPagamento: number;
  situacao?: number;
  padrao?: number;
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
  /** Desconto da venda em R$, no nível do pedido — ver computeOrderDiscount no BlingSyncTargetAdapter. */
  discountAmount: number;
  dueDate: string;
  items: CreateSalesOrderItem[];
}

export interface CreateSalesOrderResult {
  externalId: string;
}

export interface GenerateNfceResult {
  nfceId: number;
}

export interface NfceDetails {
  /** Código numérico bruto do Bling — ver domain FiscalDocument.externalStatus. 1 Pendente, 2 Cancelada, 3 Aguardando recibo, 4 Rejeitada, 5 Autorizada, 6 Emitida DANFE, 7 Registrada, 8 Aguardando protocolo, 9 Denegada, 10 Consulta situação, 11 Bloqueada. */
  situacao: number | null;
  numero: string | null;
  chaveAcesso: string | null;
  linkDanfe: string | null;
  qrCodeUrl: string | null;
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

  /** Uma página de `GET /produtos` (`pagina`/`limite` — paginação padrão da API v3 do Bling). Retorna [] quando a página não tem mais itens — chamador decide quando parar. */
  async listProductsPage(accessToken: string, pagina: number, limite = 100): Promise<BlingProductListItem[]> {
    const result = await this.request<BlingListEnvelope<BlingProductListItem>>(
      accessToken,
      "GET",
      `/produtos?pagina=${pagina}&limite=${limite}`,
    );
    return result.data ?? [];
  }

  /**
   * `GET /formas-pagamentos` — plural nos DOIS termos. A Sprint 7 concluiu que
   * "o Bling não tem endpoint de listagem de formas de pagamento" depois de
   * `GET /formas-pagamento` (singular no segundo) voltar 404; o endpoint
   * sempre existiu, só com outro nome (confirmado na entidade
   * `formasDePagamento` da lib pública `bling-erp-api-js`). Achado em
   * 2026-08-19, ao descobrir que TODA venda estava falhando com
   * "Id da forma de pagamento inválido" por causa do id fixo em config.
   */
  async listPaymentMethods(accessToken: string): Promise<BlingPaymentMethod[]> {
    const result = await this.request<BlingListEnvelope<BlingPaymentMethod>>(accessToken, "GET", "/formas-pagamentos");
    return result.data ?? [];
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
      // `desconto` só entra quando existe de fato — mandar `{ valor: 0 }` num
      // pedido sem desconto é ruído desnecessário no cadastro do lojista.
      // `unidade: "REAL"` = valor absoluto em R$ (o outro válido é
      // "PERCENTUAL"), confirmado contra a interface pública da API v3.
      ...(input.discountAmount > 0
        ? { desconto: { valor: input.discountAmount, unidade: "REAL" as const } }
        : {}),
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

  /**
   * Gera uma NFC-e a partir de um pedido de venda já criado — Bling resolve
   * os dados fiscais (NCM/CFOP/CST etc.) do lado dele, a partir do cadastro
   * do produto e da configuração fiscal da conta; não precisamos enviar nada
   * disso aqui. Confirmado contra a lib de terceiro (bling-erp-api-js,
   * `PedidosVendas.generateNfce`) na Sprint 12 — só cria a NFC-e como
   * rascunho ("Pendente"), ainda não transmite pra SEFAZ (isso é `sendNfce`).
   */
  async generateNfceFromOrder(accessToken: string, pedidoVendaId: number): Promise<GenerateNfceResult> {
    const result = await this.request<BlingItemEnvelope<{ idNotaFiscal: number }>>(
      accessToken,
      "POST",
      `/pedidos/vendas/${pedidoVendaId}/gerar-nfce`,
      {},
    );
    if (!result.data?.idNotaFiscal) {
      throw new Error(`Bling não retornou o id da NFC-e gerada: ${JSON.stringify(result)}`);
    }
    return { nfceId: result.data.idNotaFiscal };
  }

  /**
   * Transmite a NFC-e pra SEFAZ — ação fiscal real, diferente de
   * `generateNfceFromOrder` (que só cria o rascunho). Ver
   * BLING_NFCE_AUTO_EMIT em BlingSyncTargetAdapter e Decisões e Riscos
   * Abertos no cofre Obsidian.
   */
  async sendNfce(accessToken: string, nfceId: number): Promise<void> {
    await this.request<BlingItemEnvelope<{ xml?: string }>>(accessToken, "POST", `/nfce/${nfceId}/enviar`, {});
  }

  /**
   * O QR code pronto NÃO vem num campo próprio da resposta do Bling (spec
   * `IFindResponse` da lib de terceiro bling-erp-api-js, confirmada na
   * Sprint 14: só `chaveAcesso`/`xml`/`linkDanfe`/`linkPDF`) — mas o XML
   * autorizado que o Bling devolve já traz a tag `<infNFeSupl><qrCode>`
   * (padrão nacional NFC-e, o próprio conteúdo pronto pra virar QR code,
   * gerado pela SEFAZ na autorização). Extraído daqui em vez de reconstruído
   * na mão a partir de UF+chave — cada estado tem seu próprio host de
   * consulta, montar errado geraria um QR code que não abre a nota certa
   * num cupom fiscal de verdade.
   */
  async findNfce(accessToken: string, nfceId: number): Promise<NfceDetails> {
    const result = await this.request<
      BlingItemEnvelope<{ situacao?: number; numero?: string; chaveAcesso?: string; linkDanfe?: string; xml?: string }>
    >(accessToken, "GET", `/nfce/${nfceId}`);
    return {
      situacao: result.data?.situacao ?? null,
      numero: result.data?.numero ?? null,
      chaveAcesso: result.data?.chaveAcesso ?? null,
      linkDanfe: result.data?.linkDanfe ?? null,
      qrCodeUrl: extractQrCodeUrl(result.data?.xml),
    };
  }

  private async request<T>(accessToken: string, method: string, path: string, body?: unknown, attempt = 1): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Bling limita requisições por segundo (achado na prática: paginação de
    // /produtos disparando página após página bate no limite por volta da
    // 6ª página). Retenta com backoff em vez de derrubar a sincronização —
    // usa Retry-After se o Bling mandar, senão backoff exponencial curto.
    if (response.status === 429 && attempt <= MAX_RATE_LIMIT_RETRIES) {
      await response.body?.cancel();
      const retryAfterHeader = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : attempt * 1000;
      this.logger.warn(`Bling API ${method} ${path} — rate limit (HTTP 429), tentativa ${attempt}/${MAX_RATE_LIMIT_RETRIES}, aguardando ${delayMs}ms`);
      await sleep(delayMs);
      return this.request<T>(accessToken, method, path, body, attempt + 1);
    }

    const parsed = (await response.json().catch(() => null)) as (T & BlingErrorEnvelope) | null;
    if (!response.ok) {
      // `error.message` do Bling costuma ser um resumo genérico demais pra
      // depurar ("Não foi possível salvar a venda") — `error.description`
      // é onde a validação específica de verdade costuma vir (campo por
      // campo). Achado real (2026-08-18): sem isso, um 400 de verdade fica
      // opaco tanto no log quanto no SyncJob.lastError — inclui o corpo
      // inteiro do erro nos dois lugares agora.
      const message = parsed?.error?.message ?? JSON.stringify(parsed);
      const detail = parsed?.error?.description ? ` — ${JSON.stringify(parsed.error.description)}` : "";
      this.logger.error(
        `Bling API ${method} ${path} falhou (HTTP ${response.status}): ${message}${detail} | corpo completo da resposta: ${JSON.stringify(parsed)} | corpo enviado: ${JSON.stringify(body)}`,
      );
      throw new Error(`Bling API ${method} ${path} falhou (HTTP ${response.status}): ${message}${detail}`);
    }
    return (parsed ?? ({} as T)) as T;
  }
}

const MAX_RATE_LIMIT_RETRIES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `<infNFeSupl><qrCode>` no XML autorizado — ver comentário de `findNfce` acima. */
function extractQrCodeUrl(xml: string | undefined | null): string | null {
  if (!xml) {
    return null;
  }
  const tagMatch = xml.match(/<qrCode>([\s\S]*?)<\/qrCode>/);
  const tagContent = tagMatch?.[1];
  if (!tagContent) {
    return null;
  }
  const raw = tagContent.trim();
  const cdataMatch = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  const value = (cdataMatch?.[1] ?? raw).trim();
  return value || null;
}
