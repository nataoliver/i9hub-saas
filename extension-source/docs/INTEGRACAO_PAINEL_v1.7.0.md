# Contrato de integração com painel — i9Hub v1.7.0 / Fase 11

O painel administrativo não foi alterado nesta entrega. A extensão já contém o novo entitlement e aplica o controle local por licença.

## Catálogo
- `FEATURE_CATALOG_VERSION`: 12
- Total de IDs: 88
- Funcionalidades implementadas: 87
- Novo entitlement: `dashboard.management_intelligence`

## Descrição sugerida
"Inteligência gerencial: projeção indicativa de faturamento, alertas de metas, oportunidades paradas, desempenho por vendedor/equipe, resultados por produto e nicho e parecer executivo com IA."

## Ações e dependências
- `DASHBOARD_GET_MANAGEMENT_INTELLIGENCE` → `dashboard.management_intelligence`
- `DASHBOARD_GENERATE_MANAGEMENT_INSIGHTS` → `dashboard.management_intelligence`

Dependências efetivas:
- `dashboard.commercial_performance`
- `crm.leads`
- `crm.kanban`

## Compatibilidade retroativa
O catálogo da extensão contém uma ponte de compatibilidade: tokens já emitidos com `dashboard.commercial_performance` são aceitos como entitlement legado equivalente a `dashboard.management_intelligence`. Assim, a nova versão não exige reemissão imediata das licenças existentes.

Para novos planos, o painel pode cadastrar e selecionar `dashboard.management_intelligence`. Como o recurso depende de `dashboard.commercial_performance`, `crm.leads` e `crm.kanban`, esses direitos também precisam constar no token. Não remover o direito antigo dos planos enquanto houver extensões anteriores instaladas.

## Atualizações necessárias no painel
1. Importar o catálogo canônico v12 (88 IDs, 87 implementados).
2. Cadastrar `dashboard.management_intelligence` como funcionalidade ativa.
3. Exibir a descrição comercial acima no editor de planos.
4. Permitir seleção do novo entitlement nos planos desejados.
5. Preservar `dashboard.commercial_performance` e suas permissões durante a migração.
6. Garantir que a atualização de catálogo seja aditiva e não invalide tokens, conexões ou licenças existentes.

## Dados enviados ao provedor de IA
A chamada é iniciada pelo usuário na extensão e usa a chave já armazenada no perfil Chrome. O payload contém indicadores agregados, aliases de vendedores/equipes e categorias/segmentos. Não inclui nomes, telefones, e-mails, IDs ou mensagens de leads. O painel administrativo não recebe esses dados nesta fase.

## Custos e limites
- O provedor configurado pode cobrar pelo uso da API.
- A geração é sob demanda.
- Há intervalo mínimo de um minuto entre solicitações por perfil Chrome.
- A chave não é enviada ao painel administrativo.
