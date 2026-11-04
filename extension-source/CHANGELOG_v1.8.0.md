# i9Hub v1.8.0 — Fase 12: Sincronização Comercial entre Dispositivos

## Novidades
- Sincronização entre computadores dos cadastros de vendedores, equipes, produtos/serviços e metas.
- Sincronização das probabilidades configuradas para as etapas do funil comercial.
- Arquivo comercial separado no Google Drive (`i9leads-commercial-backup.json`) para manter compatibilidade com versões anteriores da extensão.
- Mesclagem por identificador estável, priorizando a alteração mais recente.
- Histórico de equipes do vendedor é unido durante a mesclagem, sem descartar atribuições anteriores.
- Desativações e exclusões lógicas mais recentes são preservadas.
- Instantâneos diários do arquivo comercial, mantendo os últimos sete dias.
- Proteção: limpeza física total dos cadastros comerciais pausa a sincronização automática para evitar apagar o backup compartilhado.
- Tela de backup agora informa quantidades locais e sincronizadas de vendedores, equipes, produtos e metas.

## Compatibilidade e segurança
- Mantido o catálogo de funcionalidades v12 e o entitlement existente `drive.sync`; não é necessária uma nova permissão de licença.
- O arquivo principal do backup não foi alterado para transportar os novos dados. Isso evita que instalações v1.7.0 ou anteriores apaguem os dados comerciais adicionados nesta fase.
- Chaves de API, licença, chave de licença, senha de sincronização, autorizações, logs e aparência local continuam fora dos backups em texto aberto.
- A sincronização comercial usa a mesma conta Google Drive conectada pelo usuário.

## Validação automatizada
- `npm run check`: 133 arquivos JavaScript/MJS verificados.
- `npm test`: 347 testes aprovados, 0 falhas.
- `npm run validate`: aprovado.

## Limites
- A sincronização entre computadores depende de todos utilizarem a mesma conta Google Drive e manterem a sincronização ativada.
- Esta fase sincroniza configurações comerciais; não cria ainda um painel administrativo central nem um endpoint de consolidação no backend.
