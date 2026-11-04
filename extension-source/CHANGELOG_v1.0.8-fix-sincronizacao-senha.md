# i9Hub v1.0.8 — Correção da sincronização da senha da IA

## Correções
- O botão “Salvar senha e sincronizar” preserva as edições pendentes do formulário do Chat com IA.
- Em instalações novas, os campos padrão não substituem a configuração recuperada do Google Drive; alterações feitas antes da restauração são reaplicadas e salvas por cima da configuração recuperada.
- Após restaurar chaves criptografadas, a extensão não executa um segundo merge imediato que poderia reintroduzir configurações antigas.
- A interface atualiza o estado de sincronização sem recarregar indevidamente o formulário quando há alterações locais a preservar.
- As chaves continuam protegidas com AES-GCM e não são enviadas ao Drive em texto aberto.

## Observação
O status de ativação da IA continua exigindo teste do provedor no computador atual antes de ativar respostas automáticas.
