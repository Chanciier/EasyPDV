# Padrões de Código — EasyPDV

- **Nomenclatura**: classes/tipos `PascalCase`; variáveis/funções `camelCase`; arquivos/pastas `kebab-case`; eventos e env vars `SCREAMING_SNAKE_CASE`; eventos de domínio sempre no passado (`SaleConfirmed`).
- **Pastas**: todo módulo segue `domain/ → application/ → infrastructure/`.
- **Imports**: sempre por alias de pacote/módulo, nunca `../../../` cruzando fronteira de módulo — só via *barrel export* (`index.ts`) da camada `application`.
- **DTOs**: sempre separados de Entities. Um DTO de entrada e um de saída por operação, validados por schema Zod de `@easypdv/shared-validation`.
- **Entities**: classes de domínio puras — não são o modelo do Prisma. Mapeamento Prisma↔Entity só no Repository.
- **Use Cases**: uma classe por operação, método único `execute()` (`ConfirmSaleUseCase`).
- **Controllers**: finos — só HTTP → Use Case → DTO, sem regra de negócio.
- **Services**: lógica de domínio reutilizável por múltiplos Use Cases, sem orquestrar um fluxo inteiro (`PriceResolutionService`).
- **Repositories**: interface em `application`, implementação em `infrastructure`; um por agregado raiz, métodos com significado de domínio, nunca CRUD genérico.
- **Events**: eventos de domínio (in-process) separados de eventos de integração (fila) — regra estrutural, não escolha por caso.
- **Adapters**: um por sistema externo (`infrastructure/adapters/bling/`), implementando a porta abstrata — nenhum tipo interno escapa da própria pasta.
- **Factories**: constroem agregados complexos respeitando invariantes de criação (`SaleFactory.startNew(...)`).
- **Specifications**: regra estrutural reutilizável e testável (`IsCashSessionOpenSpecification`).
- **Policies**: decisão de autorização dependente de papel (`DiscountAuthorizationPolicy`) — distinta de Specification.
