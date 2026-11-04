# i9Hub v1.8.0 — Fase 12: Sincronização Comercial entre Dispositivos

A versão 1.8.0 preserva as Fases 01 a 11 e amplia o backup existente do Google Drive para sincronizar os cadastros de gestão comercial e as probabilidades do funil entre computadores.

## Recursos preservados da Fase 11
- Projeção indicativa de faturamento pelo ritmo linear do mês.
- Atingimento atual e projetado das metas.
- Alertas de metas em atenção, risco ou não alcançadas.
- Identificação de oportunidades paradas há 7 dias ou mais.
- Performance por vendedor e equipe.
- Resultado por produto/serviço e por nicho/segmento.
- Recomendações comerciais determinísticas.
- Parecer executivo com IA usando provedor e chave já configurados em Atendimento IA.

## Novidades da Fase 12
- Sincronização de vendedores, equipes, produtos/serviços e metas mensais.
- Sincronização das probabilidades das etapas do funil.
- Mesclagem por ID e data da última alteração.
- Preservação do histórico de equipe e das desativações.
- Arquivo comercial separado para proteger a compatibilidade com versões anteriores.
- Instantâneos diários do arquivo comercial, com retenção dos últimos sete dias.
- Proteção contra limpeza física acidental dos cadastros comerciais.
- Exibição dos totais locais e remotos na tela de Google Drive.

## Regras e limites
A sincronização entre computadores exige que todos utilizem a mesma conta Google Drive. Alterações são enviadas pela fila automática existente e o pull periódico ocorre a cada 10 minutos. A projeção de faturamento continua sendo run-rate linear, não previsão estatística. A análise por IA é iniciada pelo usuário, pode gerar custos e não altera o CRM nem envia mensagens.

A Fase 12 sincroniza cadastros comerciais entre dispositivos; não publica ainda indicadores em uma tela consolidada no painel administrativo/backend.

## Licenciamento
- Catálogo v12: 88 IDs, 87 implementados.
- Nenhum entitlement novo; a Fase 12 utiliza `drive.sync`.
- Nenhum ID anterior foi removido ou renomeado.

## Documentação
- `CHANGELOG_v1.8.0.md`
- `RELATORIO_IMPLEMENTACAO_FASE_12_v1.8.0.md`
- `GUIA_HOMOLOGACAO_FASE_12_v1.8.0.md`
- `INSTALAR-i9Hub-1.8.0.txt`
- `docs/SINCRONIZACAO_COMERCIAL_DISPOSITIVOS_v1.8.0.md`
- `RELATORIO_IMPLEMENTACAO_FASE_11_v1.7.0.md`
- `GUIA_HOMOLOGACAO_FASE_11_v1.7.0.md`

## Instalação
1. Faça backup da instalação atual.
2. Preserve a instalação e o ID atual; não desinstale a extensão.
3. Copie os arquivos da versão 1.8.0 sobre a pasta já carregada.
4. Em `chrome://extensions`, clique em **Recarregar**.
5. Conecte a mesma conta Google Drive em cada computador e execute a primeira sincronização.
6. Homologue com dados fictícios antes de utilizar os indicadores em decisões comerciais.
