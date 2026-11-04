# i9Hub 1.1.0 — Taxonomia dinâmica e funil configurável

## Novidades

1. **Taxonomia comercial dinâmica:** a IA pode classificar um lead em múltiplos caminhos de nicho e subnicho, além de adicionar etiquetas internas livres.
2. **Criação baseada em evidências:** uma classificação automática só é aplicada quando a IA apresenta evidências e confiança mínima. A instrução de atendimento proíbe confundir profissão com assunto apenas mencionado.
3. **Gestão de nichos:** nova área no CRM para visualizar a árvore, criar nichos e subnichos, criar etiquetas livres, renomear e remover classificações. Nichos que ainda têm subnichos não podem ser removidos até que a árvore seja reorganizada.
4. **Gestão de etapas do CRM:** renomear etapas principais, adicionar e reordenar etapas personalizadas e remover etapas personalizadas com migração obrigatória de leads quando necessário.
5. **Card mais completo:** exibe caminhos de nicho, etiquetas internas, confiança e evidências da classificação da IA.
6. **Filtros e campanhas:** nichos e etiquetas gerados pela IA passam a ser considerados nos filtros de tags do CRM e na seleção de segmentos.
7. **Exportação CSV:** inclui etiquetas de IA, caminho(s) de nicho, pedido exato e resumo comercial.
8. **Google Drive:** backup e sincronização passam a incluir a configuração do funil e a taxonomia dinâmica, com mesclagem de nós por ID e versão de atualização.
9. **Google Sheets:** a aba `Leads` recebe as colunas `Nicho principal`, `Caminho de nicho` e `Etiquetas IA`. A extensão atualiza o cabeçalho existente para a nova versão sem criar uma planilha duplicada.
10. **Versão técnica:** manifesto `1.1.0.0`, versão comercial `1.1.0`; pontes de conteúdo atualizadas para impedir reutilização de scripts da versão anterior.

## Compatibilidade e proteção de dados

- IDs das etapas padrão são preservados; a renomeação não quebra os leads já existentes.
- Etapas essenciais do sistema podem ser renomeadas, mas não removidas. Etapas personalizadas exigem migração dos leads antes da exclusão.
- A IA não altera automaticamente etapas Fechado, Perdido ou Black list.
- A taxonomia usa IDs estáveis e exclusão lógica, preservando referências históricas.
- As chaves de API não são copiadas para a planilha de leads; as regras existentes de criptografia de segredos no backup do Drive permanecem.
- As etiquetas internas não dependem de etiquetas nativas do WhatsApp Business.

## Validação

- `npm run validate` — verificação estática e suíte automatizada.
- Testes adicionados para taxonomia hierárquica, etiquetas livres, confiança/evidências, múltiplos nichos por lead, gestão de etapas e inclusão dos dados no backup do Drive.
- A validação automatizada não substitui o teste manual no Chrome com uma licença válida, WhatsApp Web e OAuth do Google Drive/Sheets.
