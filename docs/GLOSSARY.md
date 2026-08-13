# Glossário — EasyPDV

Vocabulário ubíquo do domínio — usar esses termos de forma consistente no código, não sinônimos.

| Termo | Significado |
|---|---|
| PDV local | O app instalado no PC da loja (Electron + backend local + SQLite) |
| Intermediador | Serviço no Railway que fala com o Bling |
| Sessão de caixa | Vínculo temporário entre um operador e um caixa físico, do abrir ao fechar |
| Venda confirmada | Venda com pagamento completo registrado — só a partir daqui debita estoque e sincroniza |
| Comprovante | Documento não-fiscal impresso na hora, sempre local |
| Cupom fiscal / NFC-e | Documento fiscal de verdade, emitido via Bling, assíncrono |
| Adapter | Implementação de uma porta abstrata para um ERP específico (só Bling na V1) |
| Outbox | Registro durável de uma sincronização pendente, gravado na mesma transação da mudança de estado |
| Sync job | Unidade de trabalho de sincronização processada pelo Worker no Intermediador |
