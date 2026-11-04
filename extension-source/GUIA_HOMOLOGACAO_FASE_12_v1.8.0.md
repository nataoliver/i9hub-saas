# Guia de homologação — i9Hub v1.8.0 / Fase 12

## Preparação
1. Faça backup pelo menu Configurações → Dados → Exportar Backup.
2. Atualize para a versão 1.8.0 mantendo a mesma identidade da extensão.
3. Não clique em Remover e não desinstale a extensão.
4. Conecte o Google Drive nos dois computadores usando a mesma conta Google.
5. Confirme que a sincronização automática está ativada.

## A — Primeiro envio e recuperação
1. No computador A, cadastre uma equipe, um vendedor, um produto e uma meta mensal.
2. Aguarde o envio automático ou clique em **Sincronizar agora**.
3. No computador B, clique em **Sincronizar agora**.
4. Confira se equipe, vendedor, produto e meta aparecem no computador B.
5. Confira em Configurações → Dados os totais locais e no Drive.

## B — Alterações nos dois computadores
1. No computador A, altere a comissão padrão do vendedor.
2. No computador B, altere o vínculo do vendedor com uma equipe ou cadastre outro produto.
3. Sincronize A e B, um de cada vez.
4. Confira que registros diferentes foram preservados e que o registro editado mais recentemente prevalece quando o mesmo ID é alterado nos dois lados.
5. Confira que o histórico de equipes não perdeu as atribuições anteriores.

## C — Metas e probabilidades
1. Crie metas para vendedor e equipe no computador A.
2. Configure probabilidades de etapas no computador B.
3. Sincronize os dois computadores.
4. Abra Dashboard → Gestão de metas, equipes e comissões e confira os cadastros.
5. Abra Dashboard → Relatórios e inteligência de performance e confira as probabilidades.

## D — Desativação e proteção contra limpeza
1. Desative um vendedor ou produto pelo fluxo normal da interface; confirme que o registro permanece no histórico como inativo.
2. Sincronize e confirme a desativação no outro computador.
3. Em ambiente de teste, simule a limpeza física total de `commercialManagementConfig`.
4. Confirme que a sincronização automática é pausada e exibe o aviso `MANAGEMENT_CLEAR`.
5. Clique em Sincronizar agora e confirme que a mesclagem recupera os dados remotos, sem apagar o backup.

## E — Compatibilidade com versões anteriores
1. Atualize um computador para 1.8.0 e mantenha outro temporariamente em 1.7.0 apenas em ambiente de homologação.
2. Faça uma sincronização comercial pela 1.8.0.
3. Execute uma sincronização pela 1.7.0.
4. Volte à 1.8.0 e confirme que `i9leads-commercial-backup.json` continua disponível e íntegro.

## F — Recuperação
1. Confirme que o arquivo comercial recebe um instantâneo diário.
2. Verifique que a pasta mantém no máximo os sete instantâneos comerciais mais recentes.
3. Teste restauração e sobrescrita somente com dados fictícios, pois são operações explícitas.

## Critério de aprovação
- Cadastros comerciais e probabilidades chegam ao segundo computador.
- Alterações distintas são mescladas.
- Conflito no mesmo ID respeita `updatedAt`.
- Histórico de equipe e desativações são preservados.
- A limpeza total pausa o envio automático.
- A versão anterior não apaga o arquivo comercial separado.
- O backup principal e as funcionalidades das Fases 01 a 11 continuam funcionando.
