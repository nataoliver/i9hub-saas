# i9Hub v1.6.0 — Fase 10: Gestão de Metas, Equipes e Comissões Comerciais

## Novidades
- Cadastro local de vendedores com nome, equipe, status e comissão padrão.
- Cadastro de equipes com preservação de histórico de vínculo do vendedor.
- Cadastro de produtos e serviços com percentual de comissão próprio.
- Metas mensais individuais e coletivas por receita, quantidade de vendas e quantidade de leads atribuídos.
- Comparativo de meta x realizado e alertas de ritmo: no ritmo, atenção, em risco, alcançada, não alcançada ou agendada.
- Ranking mensal de vendedores por receita registrada e quantidade de vendas.
- Resultado mensal por equipe e por produto/serviço.
- Cálculo de comissão por venda: percentual do produto/serviço prevalece; sem produto, usa a comissão padrão do vendedor.
- Snapshot do percentual e do valor da comissão no fechamento/registro do valor vendido para preservar o histórico.
- Controle manual de comissão pendente/paga, com histórico CRM.
- Vínculo de vendedor e produto/serviço no card do lead por lista de sugestões do catálogo.
- Bloqueio de alteração de vendedor, produto, valor vendido ou etapa de uma venda com comissão paga, até reabrir a comissão.
- Desativação de cadastros sem apagar histórico de vendas.
- Novo entitlement de catálogo `dashboard.commercial_management`; ações da extensão continuam usando `dashboard.commercial_performance` para compatibilidade até a atualização do painel administrativo.
- Catálogo atualizado para v11.
- Release da extensão atualizado para 1.6.0.

## Regras de cálculo
- Receita e comissões consideram somente leads atualmente em etapa reconhecida como ganho, com data de fechamento rastreável e `saleValue` positivo.
- Comissão = `saleValue × commissionRateAtSale ÷ 100`.
- Produto/serviço selecionado tem prioridade sobre a comissão padrão do vendedor.
- Percentual e valor da comissão são congelados no snapshot da venda. Alterações futuras nas regras não recalculam vendas já registradas.
- A comissão é marcada como paga manualmente; a extensão não realiza transferência bancária nem processa folha de pagamento.
- Meta de receita usa soma de `saleValue`; meta de vendas usa contagem de vendas; meta de leads usa atribuições iniciadas no mês. Uma meta pode combinar as três dimensões; o status geral usa o menor percentual de atingimento entre as dimensões configuradas.
- O alerta de risco compara atingimento com o percentual linear do mês transcorrido; é um sinal operacional, não uma previsão estatística.

## Compatibilidade e armazenamento
- Cadastros, metas e configuração de comissões ficam em `chrome.storage.local` no perfil Chrome atual.
- Leads da Fase 09 são associados a vendedores cadastrados por ID ou correspondência normalizada do nome. Registros sem histórico suficiente não recebem datas inventadas.
- Vendas antigas sem snapshot podem usar a regra atual para estimar a comissão e são marcadas para revisão.
- Dados não são consolidados automaticamente entre computadores.
- O painel administrativo não foi modificado nesta fase.

## Licenciamento
- Novo ID preparado no catálogo: `dashboard.commercial_management`.
- Compatibilidade temporária: os endpoints da Fase 10 exigem `dashboard.commercial_performance`, `crm.leads` e `crm.kanban`.
- Quando o painel administrativo for atualizado, poderá emitir o novo entitlement dedicado sem alterar o modelo de dados local.

## Validação
- `npm run check`: 130 arquivos JavaScript/MJS verificados.
- `npm test`: 335 testes aprovados, zero falhas.
- `npm run validate`: concluído com sucesso.
- ZIP conferido: integridade e versão 1.6.0 validadas.

A homologação em Chrome real continua necessária para verificar a experiência de cadastro, os valores de vendas reais e as permissões emitidas pelo painel.
