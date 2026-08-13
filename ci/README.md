# ci/

Reservado para extrair a lógica de pipeline (lint/build/test/deploy) de dentro do
`.github/workflows/ci.yml` para scripts próprios, agnósticos de provedor — assim
trocar de CI no futuro não exige reescrever a lógica, só o arquivo que a invoca.

No Sprint 0 a lógica ainda está inline no workflow por simplicidade. Extrair para
cá quando o pipeline crescer além de `pnpm turbo run <task>`.
