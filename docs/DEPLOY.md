# Deploy — EasyPDV

## PDV local

Distribuído como instalador Windows (`.exe`, NSIS via `electron-builder`) — instalado diretamente no PC de cada loja. Não depende de infraestrutura de deploy tradicional; atualização via `electron-updater` (ver [ELECTRON.md](./ELECTRON.md)).

## Intermediador

Hospedado no **Railway**. Build via `docker/Dockerfile.intermediador`. Dependências (Postgres, Redis) também gerenciadas no Railway em produção — `docker/docker-compose.yml` é só para desenvolvimento local.

Variáveis de ambiente necessárias: ver `apps/intermediador/.env.example`. Credenciais OAuth do Bling por organização nunca ficam em texto puro — usar o cofre de segredo do Railway.

## CI

`.github/workflows/ci.yml` roda lint/typecheck/build/test via Turborepo em todo push/PR. Deploy do Intermediador para o Railway ainda não está automatizado no CI — entra quando o Sprint 7 (Adapter Bling) estiver pronto para ambiente real.
