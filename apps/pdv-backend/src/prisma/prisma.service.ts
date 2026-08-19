import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Wrapper injetável do Prisma Client. Compartilhado por todos os módulos —
 * repositórios de infrastructure/ dependem disso, nunca o domínio.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    // SQLite no modo padrão (rollback journal) bloqueia TODA leitura enquanto
    // qualquer transação de escrita está aberta — descoberto na prática
    // (2026-08-19): um sync completo do catálogo Bling (~27 mil produtos,
    // ~9-10 min numa única `$transaction`) deixou o app INTEIRO fora do ar
    // durante esse tempo — busca de produto, venda, `GET /provisioning/status`,
    // tudo devolvendo erro genérico ou travando, porque o arquivo inteiro
    // fica com lock exclusivo. WAL (Write-Ahead Log) resolve exatamente isso:
    // leitores nunca esperam um escritor (só escritor espera escritor).
    // `PRAGMA` retorna uma linha de resultado em SQLite; `executeRawUnsafe()`
    // não aceita retorno de dados e lança `P2010` nesse caso. O correto aqui é
    // usar `queryRawUnsafe` para a execução assíncrona da PRAGMA.
    await this.$queryRawUnsafe<{ journal_mode: string }[]>("PRAGMA journal_mode=WAL;");
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
