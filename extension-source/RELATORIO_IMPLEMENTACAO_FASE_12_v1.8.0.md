# Relatório de implementação — Fase 12
## i9Hub v1.8.0 — Sincronização Comercial entre Dispositivos

**Base:** i9Hub v1.7.0 (Fases 01 a 11)  
**Entrega:** i9Hub v1.8.0  
**Catálogo:** v12 — 88 IDs; sem novo entitlement  
**Permissão utilizada:** `drive.sync`  
**Escopo:** extensão Chrome e integração Google Drive existente.

## 1. Problema corrigido
A sincronização anterior incluía leads, campanhas, configurações gerais, preferências da IA, etapas do CRM e taxonomia de nichos. Porém, não incluía os cadastros de vendedores, equipes, produtos/serviços, metas e probabilidades do funil. Como consequência, computadores que compartilhavam o mesmo backup podiam apresentar configurações gerenciais diferentes.

## 2. Implementação
- Novo arquivo independente `i9leads-commercial-backup.json` na pasta `i9Leads Flow - Backup`.
- Sincronização de `commercialManagementConfig`:
  - vendedores e comissão padrão;
  - equipes e vínculos;
  - histórico de mudanças de equipe;
  - produtos/serviços e comissão;
  - metas mensais por vendedor ou equipe.
- Sincronização de `commercialPerformanceConfig.stageProbabilities`.
- Mesclagem por ID; para registros legados sem ID, uso de chave auxiliar por nome ou chave natural da meta.
- Em conflitos do mesmo registro, vence a versão com `updatedAt` mais recente; em empate, o registro local é preservado.
- Histórico `teamHistory` é unido e limitado aos 100 registros mais recentes.
- Desativações (`active: false`) e exclusões lógicas de metas (`deletedAt`) são preservadas como alterações, não como remoções físicas.
- Probabilidades das etapas usam a configuração com data de atualização mais recente.
- Arquivo comercial separado do backup principal: versões anteriores não conhecem nem sobrescrevem esse arquivo.
- Instantâneos diários separados, com retenção dos últimos sete dias.
- Alterações locais nos dois cadastros comerciais acionam a fila automática existente.
- Limpeza física total dos cadastros comerciais pausa o envio automático para proteger o backup remoto.
- Estado do Google Drive passa a exibir quantidades de vendedores, equipes, produtos e metas.

## 3. Arquivos alterados
- `background/drive-sync.js`
- `background/service-worker.js` (identificação da versão do módulo)
- `sidepanel/components/SettingsView.js`
- `sidepanel/sidepanel.css`
- `content/content.js`
- `content/injected.js`
- `manifest.json`
- `package.json`
- testes de versão e novos testes da Fase 12.

## 4. Compatibilidade
- O arquivo principal `i9leads-backup.json` mantém o schema anterior.
- Os dados comerciais ficam em arquivo separado para impedir que uma extensão v1.7.0 ou anterior remova campos que ela desconhece.
- Nenhum ID do catálogo foi removido ou renomeado.
- Não foi criado novo entitlement: a função utiliza `drive.sync`, já existente.
- A identidade da extensão deve ser preservada durante a atualização; não desinstalar a versão anterior.

## 5. Privacidade e limites
- O novo arquivo contém configurações comerciais (nomes de vendedores/equipes/produtos e metas), não o conteúdo de conversas ou a lista de contatos.
- O backup principal continua com os dados CRM que já eram sincronizados na versão anterior.
- Licença, chave de licença, senha de sincronização e autorizações locais permanecem fora do backup aberto.
- Esta entrega sincroniza dados entre dispositivos pela mesma conta Google Drive. Não implementa ainda consolidação no painel administrativo/backend.

## 6. Validação automatizada
- `npm run check`: aprovado; manifesto e 133 arquivos JavaScript/MJS verificados.
- `npm test`: 347 testes aprovados, 0 falhas.
- `npm run validate`: concluído com sucesso.

## 7. Homologação manual pendente
Ainda é necessário testar dois computadores conectados à mesma conta Google Drive, com alterações em cada lado, para confirmar OAuth real, envio/recebimento e mesclagem sem perda.
