# config/

Templates de configuração por ambiente — nunca segredo real (isso vive no cofre de
segredo do Railway em produção, e em `.env` local, gitignorado).

Cada app já tem seu próprio `.env.example` (`apps/pdv-backend/.env.example`,
`apps/intermediador/.env.example`). Esta pasta é reservada para configuração que
atravessa múltiplos apps (ex: perfis de ambiente compartilhados) conforme o
projeto crescer — vazia de propósito no Sprint 0.
