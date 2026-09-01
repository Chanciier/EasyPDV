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
  /** CPF/CNPJ do contato — confirmado contra a API real (2026-08-19), campo `numeroDocumento` (não `documento`/`cpf`, que eram só candidatos). */
  numeroDocumento?: string;
  /** Só vem em `GET /contatos/{id}` (detalhe) — a listagem/busca NÃO traz esse campo. Array — um contato pode ter vários tipos simultâneos (ex.: "Cliente" + "Clube Saldão"). */
  tiposContato?: { id: number; descricao: string }[];
  /** Campos abaixo só vêm no detalhe (`GET /contatos/{id}`) — necessários pra reconstruir o corpo de um `PUT /contatos/{id}` sem perder dado (ver `updateContact`). */
  tipo?: "F" | "J";
  situacao?: string;
  /** Celular do contato (2026-09-02) — confirmado no schema oficial da API v3 (`POST /contatos`, doc pública): campo top-level "celular", distinto de "telefone" (fixo). Usado pelo Clube Saldão. */
  celular?: string;
}

export interface BlingContactType {
  id: number;
  descricao: string;
}

/**
 * Situação de pedido de venda — id é ESPECÍFICO DA CONTA (achado real,
 * 2026-08-19, testando contra o Bling do usuário: módulo "Vendas" tem id
 * fixo 98310, mas os ids das situações dentro dele — "Em aberto"=6,
 * "Atendido"=9 nesta conta — não têm garantia documentada de serem os
 * mesmos em outra conta). Por isso resolvido por NOME via `GET
 * /situacoes/modulos/{idModulo}` e cacheado, nunca hardcoded.
 */
export interface BlingOrderSituacao {
  id: number;
  nome: string;
}

/** Módulo "Vendas" (Pedidos de Venda) — constante fixa do Bling, confirmada contra `GET /situacoes/modulos` real (não muda por conta). */
const SALES_ORDER_MODULE_ID = 98310;

/** `situacao: "A"` = ativo (mesma convenção de `BlingProductListItem.situacao`, confirmada contra a interface pública `depositos/interfaces/get.interface.ts`). `padrao: true` marca o depósito padrão da conta. */
export interface BlingWarehouse {
  id: number;
  descricao: string;
  situacao?: string;
  padrao?: boolean;
}

/** `operacao`: `"E"` entrada, `"S"` saída, `"B"` balanço (ajuste pro valor informado). Ver `resolveWarehouseId`/`pushStockMovements` em BlingSyncTargetAdapter. */
export interface CreateStockMovementInput {
  produtoId: number;
  depositoId: number;
  operacao: "E" | "S" | "B";
  quantidade: number;
  observacoes?: string;
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

/** Pagamento dividido (2026-08-21) — uma entrada por perna de pagamento, cada uma com sua própria forma de pagamento no Bling. Soma de `valor` precisa fechar com `totalAmount`. */
export interface CreateSalesOrderParcela {
  valor: number;
  formaPagamentoId: number;
}

export interface CreateSalesOrderInput {
  contatoId: number;
  parcelas: CreateSalesOrderParcela[];
  totalAmount: number;
  /** Desconto da venda em R$, no nível do pedido — ver computeOrderDiscount no BlingSyncTargetAdapter. */
  discountAmount: number;
  dueDate: string;
  items: CreateSalesOrderItem[];
  /**
   * `saleId` local — vai em `observacoesInternas` (achado real, 2026-08-19,
   * CORRIGIDO em 2026-08-21): o Bling rejeita `POST /pedidos/vendas` com 400
   * ("Informações idênticas a última venda salva, altere alguma informação
   * caso deseje prosseguir") quando um pedido novo bate contato+itens+valor+
   * forma de pagamento+data de um pedido recente — cenário real de loja
   * pequena (mesmo produto barato, "Consumidor Final", dinheiro, mesmo dia),
   * não só teste. Um valor único por pedido evita o falso-positivo de
   * duplicata sem inventar nenhum dado.
   *
   * Esse valor foi originalmente colocado em `numeroPedidoCompra` — só que
   * esse campo é copiado pelo Bling pro grupo fiscal "dados de compra"
   * (Empenho/Pedido/Contrato) da NFC-e, e a NFC-e simplificada (DANFE
   * Simplificado Tipo 2, usada em venda de balcão) REJEITA ter esse grupo
   * preenchido — rejeição SEFAZ 762, achado real testando emissão de NFC-e
   * de verdade (2026-08-21). `observacoesInternas` é só uma nota interna do
   * pedido (não aparece no DANFE, não é campo fiscal estruturado) — resolve
   * a duplicidade sem repetir o problema.
   */
  saleId: string;
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

interface BlingErrorField {
  code: number;
  msg: string;
  element?: string;
}

interface BlingErrorEnvelope {
  error?: { message?: string; description?: unknown; fields?: BlingErrorField[] };
}

/**
 * Erro estruturado do Bling — carrega `fields` (código + mensagem por campo)
 * pra quem chama poder reagir a um código específico sem precisar
 * fazer parsing de string na mensagem (achado real, 2026-08-20: `code: 50`
 * "A venda possui a mesma situação" precisa ser tratado como sucesso em
 * `advanceSalesOrderToAtendido`, não como falha).
 */
export class BlingApiError extends Error {
  constructor(
    message: string,
    public readonly fields: BlingErrorField[],
  ) {
    super(message);
    this.name = "BlingApiError";
  }

  hasFieldCode(code: number): boolean {
    return this.fields.some((f) => f.code === code);
  }
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

  /**
   * Uma página de `GET /produtos` (`pagina`/`limite` — paginação padrão da API
   * v3 do Bling). Retorna [] quando a página não tem mais itens — chamador
   * decide quando parar. `dataAlteracaoInicial`/`dataAlteracaoFinal` (opcionais,
   * `YYYY-MM-DD`) filtram por produtos alterados nessa janela — usado pelo
   * sync incremental periódico (2026-08-19: catálogo pode ter dezenas de
   * milhares de SKUs, repaginar tudo a cada poll não é viável).
   *
   * **Achado real testando direto contra o Bling (2026-08-19)**: mandar só
   * `dataAlteracaoInicial` faz o Bling IGNORAR o filtro silenciosamente e
   * devolver o catálogo inteiro sem erro nenhum — confirmado comparando a
   * mesma chamada com e sem o parâmetro (mesma contagem de resultados nos
   * dois casos, inclusive com uma data no FUTURO). O filtro só passa a valer
   * quando `dataAlteracaoInicial` E `dataAlteracaoFinal` vêm juntos — testado
   * com uma janela no futuro e confirmado zero resultados. A interface pública
   * `IGetParams` da lib `bling-erp-api-js` documenta os dois campos mas não
   * essa dependência entre eles — só apareceu testando a API de verdade.
   */
  async listProductsPage(
    accessToken: string,
    pagina: number,
    limite = 100,
    dataAlteracaoInicial?: string,
    dataAlteracaoFinal?: string,
  ): Promise<BlingProductListItem[]> {
    const query = new URLSearchParams({ pagina: String(pagina), limite: String(limite) });
    if (dataAlteracaoInicial && dataAlteracaoFinal) {
      query.set("dataAlteracaoInicial", dataAlteracaoInicial);
      query.set("dataAlteracaoFinal", dataAlteracaoFinal);
    }
    const result = await this.request<BlingListEnvelope<BlingProductListItem>>(accessToken, "GET", `/produtos?${query.toString()}`);
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

  /** `GET /depositos` — usado pra resolver o depósito da conta antes de baixar estoque (ver `resolveWarehouseId` em BlingSyncTargetAdapter). */
  async listWarehouses(accessToken: string): Promise<BlingWarehouse[]> {
    const result = await this.request<BlingListEnvelope<BlingWarehouse>>(accessToken, "GET", "/depositos");
    return result.data ?? [];
  }

  /**
   * `POST /estoques` — registra um MOVIMENTO de estoque (não um valor
   * absoluto), confirmado contra a interface pública `estoques/interfaces/create.interface.ts`
   * (`ICreateBody`: `produto`, `deposito`, `operacao`, `quantidade`). Usado
   * pra baixar estoque no Bling a cada venda confirmada no PDV — decisão
   * (2026-08-19) de fazer isso via API de estoque explícita, e não avançando
   * a `situação` do pedido de venda (que também dispara baixa automática no
   * Bling dependendo da configuração da conta): a `situação` é workflow do
   * lojista (ele pode querer separar/despachar manualmente no painel), misturar
   * os dois criaria baixa duplicada ou interferência indesejada.
   */
  async createStockMovement(accessToken: string, input: CreateStockMovementInput): Promise<void> {
    await this.request<BlingItemEnvelope<{ id: number }>>(accessToken, "POST", "/estoques", {
      produto: { id: input.produtoId },
      deposito: { id: input.depositoId },
      operacao: input.operacao,
      quantidade: input.quantidade,
      ...(input.observacoes ? { observacoes: input.observacoes } : {}),
    });
  }

  /**
   * `?idTipoContato=` filtra de verdade no servidor (confirmado ao vivo,
   * 2026-08-25) — cuidado: `?tipoContato=` (sem "id" no nome do parâmetro)
   * NÃO filtra, devolve a lista inteira sem aplicar nada. Usado pra listar
   * os membros do Clube Saldão (contatos com esse tipo).
   */
  async listContactsByTipo(accessToken: string, tipoContatoId: number): Promise<BlingContact[]> {
    const result = await this.request<BlingListEnvelope<BlingContact>>(accessToken, "GET", `/contatos?idTipoContato=${tipoContatoId}`);
    return result.data ?? [];
  }

  async findContactByName(accessToken: string, nome: string): Promise<BlingContact | null> {
    const result = await this.request<BlingListEnvelope<BlingContact>>(accessToken, "GET", `/contatos?pesquisa=${encodeURIComponent(nome)}`);
    return result.data?.find((contact) => contact.nome === nome) ?? result.data?.[0] ?? null;
  }

  /** `?pesquisa=` busca por nome OU documento (confirmado contra a API real) — reaproveita o mesmo endpoint de `findContactByName`, só filtra o match pelo `numeroDocumento` em vez do `nome`. */
  async findContactByDocument(accessToken: string, document: string): Promise<BlingContact | null> {
    const result = await this.request<BlingListEnvelope<BlingContact>>(accessToken, "GET", `/contatos?pesquisa=${encodeURIComponent(document)}`);
    return result.data?.find((contact) => contact.numeroDocumento === document) ?? null;
  }

  /**
   * `situacao: "A"` (ativo) — achado real (2026-08-19): o Bling passou a
   * EXIGIR esse campo em `POST /contatos` (antes não exigia; `createContact`
   * sem ele funcionava até há pouco). Sem isso, todo `createContact` falha
   * com 400 "Situação inválida", inclusive pra recriar o "Consumidor Final"
   * depois de uma reconexão que limpa o cache — bug latente na conta real,
   * corrigido antes de causar um incidente.
   */
  async createContact(accessToken: string, nome: string, document?: string): Promise<BlingContact> {
    const result = await this.request<BlingItemEnvelope<BlingContact>>(accessToken, "POST", "/contatos", {
      nome,
      tipo: "F",
      situacao: "A",
      ...(document ? { numeroDocumento: document } : {}),
    });
    if (!result.data) {
      throw new Error(`Bling não retornou o contato criado: ${JSON.stringify(result)}`);
    }
    return result.data;
  }

  /** `GET /contatos/{id}` — detalhe completo, único jeito de ler `tiposContato` (a listagem/busca não traz esse campo). Usado antes de `updateContact` pra montar o corpo do PUT sem perder dado. */
  async getContactById(accessToken: string, id: number): Promise<BlingContact> {
    const result = await this.request<BlingItemEnvelope<BlingContact>>(accessToken, "GET", `/contatos/${id}`);
    if (!result.data) {
      throw new Error(`Bling não retornou o contato ${id}: ${JSON.stringify(result)}`);
    }
    return result.data;
  }

  /** `GET /contatos/tipos` — lista os tipos de contato cadastrados na conta (ex.: "Cliente", "Fornecedor", "Clube Saldão"). Ids são específicos da conta — nunca hardcoded, sempre resolvido por nome e cacheado (ver `resolveClubTipoContatoId` em BlingSyncTargetAdapter). */
  async listContactTypes(accessToken: string): Promise<BlingContactType[]> {
    const result = await this.request<BlingListEnvelope<BlingContactType>>(accessToken, "GET", "/contatos/tipos");
    return result.data ?? [];
  }

  /**
   * `PUT /contatos/{id}` — substituição de recurso, EXIGE `nome`+`tipo`+`situacao`
   * no corpo (confirmado ao vivo, 2026-08-25: sem `tipo` o Bling rejeita com 400
   * "O tipo da pessoa é um campo obrigatório") mas NÃO apaga os demais campos
   * do contato que não forem enviados (endereço, dados adicionais etc. ficam
   * intactos) — testado contra um contato real, incluindo mesclar/remover
   * `tiposContato` preservando outros tipos que o contato já tinha. Por isso
   * o chamador só precisa buscar o contato atual (`getContactById`) pra pegar
   * `nome`/`tipo`/`tiposContato` corretos antes de montar o PUT — não precisa
   * reenviar o objeto inteiro. Devolve 204 sem corpo.
   */
  async updateContact(
    accessToken: string,
    id: number,
    body: { nome: string; tipo: "F" | "J"; tiposContato: { id: number }[]; numeroDocumento?: string; celular?: string },
  ): Promise<void> {
    await this.request<void>(accessToken, "PUT", `/contatos/${id}`, { ...body, situacao: "A" });
  }

  /** `GET /situacoes/modulos/{idModulo}` — lista as situações configuradas na conta pro módulo de Pedidos de Venda. */
  async listSalesOrderSituacoes(accessToken: string): Promise<BlingOrderSituacao[]> {
    const result = await this.request<BlingListEnvelope<BlingOrderSituacao>>(accessToken, "GET", `/situacoes/modulos/${SALES_ORDER_MODULE_ID}`);
    return result.data ?? [];
  }

  /** `PATCH /pedidos/vendas/{id}/situacoes/{idSituacao}` — confirmado contra a API real (2026-08-19; é PATCH, não PUT). Devolve 204 sem corpo. */
  async updateSalesOrderSituacao(accessToken: string, pedidoVendaId: number, idSituacao: number): Promise<void> {
    await this.request<void>(accessToken, "PATCH", `/pedidos/vendas/${pedidoVendaId}/situacoes/${idSituacao}`);
  }

  async createSalesOrder(accessToken: string, input: CreateSalesOrderInput): Promise<CreateSalesOrderResult> {
    const body = {
      data: input.dueDate,
      observacoesInternas: `Venda PDV ${input.saleId}`,
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
      // Pagamento dividido (2026-08-21) — uma entrada por perna, cada uma com
      // a forma de pagamento já resolvida por resolveSalesOrder no adapter.
      parcelas: input.parcelas.map((parcela) => ({
        dataVencimento: input.dueDate,
        valor: parcela.valor,
        formaPagamento: { id: parcela.formaPagamentoId },
      })),
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
   * gerado pela SEFAZ na autorização).
   *
   * CORRIGIDO (2026-08-25, achado contra uma NFC-e real autorizada): o campo
   * `xml` de `GET /nfce/{id}` **não é o XML** — é uma URL pra baixá-lo
   * (`https://www.bling.com.br/relatorios/nfe.xml.php?chaveAcesso=...&signature=...`,
   * ~180 caracteres). Tentar extrair `<qrCode>` direto dessa string sempre
   * falhava silenciosamente (nunca continha a tag), deixando `qrCodeUrl` null
   * mesmo com a nota já autorizada — o PDV nunca imprimia a via fiscal porque
   * seu guard exige documentNumber+accessKey+qrCodeUrl todos presentes. Agora
   * baixa esse link (autenticado pela própria assinatura na URL, sem precisar
   * do token do Bling) e extrai a tag do XML de verdade.
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
      qrCodeUrl: await this.fetchQrCodeUrl(result.data?.xml),
    };
  }

  private async fetchQrCodeUrl(xmlLink: string | undefined): Promise<string | null> {
    if (!xmlLink) {
      return null;
    }
    try {
      const response = await fetch(xmlLink);
      if (!response.ok) {
        this.logger.warn(`Download do XML da NFC-e falhou (HTTP ${response.status}): ${xmlLink}`);
        return null;
      }
      const xml = await response.text();
      return extractQrCodeUrl(xml);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Não foi possível baixar o XML da NFC-e pra extrair o QR code: ${message}`);
      return null;
    }
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
      throw new BlingApiError(`Bling API ${method} ${path} falhou (HTTP ${response.status}): ${message}${detail}`, parsed?.error?.fields ?? []);
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
