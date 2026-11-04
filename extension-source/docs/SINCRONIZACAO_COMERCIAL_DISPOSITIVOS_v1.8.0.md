# Sincronização comercial entre dispositivos — Fase 12

## Arquitetura
A Fase 12 mantém o backup principal (`i9leads-backup.json`) e cria um segundo arquivo independente (`i9leads-commercial-backup.json`) dentro da pasta `i9Leads Flow - Backup`.

A separação é intencional: instalações 1.7.0 e anteriores não conhecem os novos campos. Se os dados comerciais fossem acrescentados apenas ao arquivo principal, uma versão antiga poderia regravar o JSON sem esses campos e apagá-los. O arquivo separado evita esse cenário.

## Dados sincronizados no arquivo comercial
- `commercialManagementConfig.sellers`
- `commercialManagementConfig.teams`
- `commercialManagementConfig.products`
- `commercialManagementConfig.goals`
- `commercialPerformanceConfig.stageProbabilities`

## Estratégia de mesclagem
- Registros com ID são mesclados pelo ID.
- Registros legados sem ID recebem uma chave auxiliar baseada no nome; metas usam mês, tipo e destinatário.
- O registro com `updatedAt` mais recente prevalece.
- Empate mantém o registro local.
- `teamHistory` é unido por equipe + data de atribuição.
- Desativação e exclusão lógica prevalecem quando forem a alteração mais recente.
- Probabilidades de etapa usam o conjunto cuja configuração foi atualizada mais recentemente.

## Frequência
- Alterações locais agendam envio usando a fila automática existente.
- O pull periódico segue o intervalo existente do módulo Drive (10 minutos).
- O botão Sincronizar agora executa a mesclagem imediatamente.

## Proteção de dados
- A limpeza física total de `commercialManagementConfig` pausa o envio automático.
- A operação de restauração mescla/substitui conforme o comando explicitamente escolhido.
- A operação de sobrescrita é destrutiva e exige confirmação na interface.
- O arquivo comercial não recebe telefones, e-mails, mensagens ou a lista de leads.
- O backup principal mantém os dados CRM já sincronizados antes da Fase 12.

## Compatibilidade
- Não altera o schema do arquivo principal.
- Não altera o catálogo v12 nem os 88 IDs.
- Reutiliza `drive.sync`.
- Versões antigas não escrevem no arquivo comercial independente.

## Limite
A sincronização é feita entre instalações que usam a mesma conta Google Drive. Esta fase não publica os indicadores no painel administrativo do servidor. Para isso será necessário um contrato de API e a implementação correspondente no backend.
