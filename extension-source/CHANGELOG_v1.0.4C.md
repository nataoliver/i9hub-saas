# i9Hub v1.0.4C

## Alterações desta variante

- Removido do dashboard o card **Saúde da conta WhatsApp**, incluindo a chamada `GET_COMPLIANCE_HEALTH`, o score, os detalhes e os botões associados.
- Removida do menu e do roteamento a tela **Atendimento IA**.
- Removida do menu e do roteamento a tela **Públicos de Status**.
- Removidos do dashboard os indicadores exclusivos de Atendimento IA: conversas, mensagens processadas e pedidos pendentes.
- Preservados o CRM, campanhas, contatos, mapas, chats, licenciamento, o botão **Abrir WhatsApp** e o comportamento de janelas 90/10.
- Nenhuma alteração foi feita no backend, no catálogo de funcionalidades ou nas permissões. Os componentes-fonte das duas telas retiradas foram mantidos no pacote, mas deixaram de ser importados, registrados ou acessíveis pelas rotas do painel.

## Versionamento

- Rótulo exibido: `1.0.4C` (`version_name`).
- Versão técnica do Chrome: `1.0.4.4`, numérica e superior a `1.0.4` para permitir a identificação desta variante pelo mecanismo de versões da extensão.


## Hotfix de licenciamento

- Corrigido o campo `extVersion` enviado ao painel: `version_name` é um rótulo de interface e pode conter letras (`1.0.4C`), portanto não deve ser enviado como SemVer.
- As APIs agora recebem a versão de release normalizada `1.0.4`, enquanto a interface continua exibindo `1.0.4C`.
- Atualizada a versão técnica do Chrome para `1.0.4.4` para que a correção seja reconhecida como atualização.
- A alteração não modifica endpoints, credenciais, permissões, catálogo de funcionalidades ou backend.
