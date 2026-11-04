# Guia de homologação — i9Hub v1.2.4 (Fase 01)

## Pré-requisitos
- Node.js 20 ou superior.
- ZIP extraído em pasta de teste.
- Chrome com extensão carregada em modo desenvolvedor.
- Licenças de teste emitidas pelo painel com entitlements Starter/Pro e licença administrativa.

## Testes automatizados
Execute `npm run validate`. A validação deve verificar manifesto, imports, sintaxe e todos os testes.

## Testes manuais de licença
1. Sem licença: navegar na demonstração e apresentação; tentar abrir WhatsApp, ler leads, sincronizar oportunidades, alterar estágio, exportar e iniciar campanhas. Todas as operações devem ser bloqueadas com orientação de ativação.
2. Conta licenciada sem `ent`: operações bloqueadas com `LICENSE_PERMISSIONS_MISSING`.
3. Licença com `crm.leads`: leitura/gestão de leads permitida conforme o plano; demais módulos continuam bloqueados.
4. Licença com `whatsapp.campaigns.send`, mas sem `whatsapp.connection`: iniciar campanha bloqueado.
5. Licença com ambos: a pré-validação da interface permite prosseguir e o service worker confirma novamente.
6. Licença com wildcard: recursos implementados podem ser acessados; `admin.full_access` não é inferido e recursos planejados continuam bloqueados.
7. Licença administrativa com `admin.full_access`: recursos implementados liberados e ações exclusivas do proprietário permitidas.
8. Token com ID desconhecido ou recurso `implemented:false`: acesso negado.
9. Consentimento: `CONSENT_UPDATE` deve continuar registrando opt-in/opt-out como ação de segurança, inclusive sem licença.
10. Revogação/expiração: ações operacionais bloqueadas; pausa/parada de campanha e desconexão de segurança permanecem disponíveis.

## Testes de regressão
- WhatsApp e painel lateral.
- CRM, Kanban, sincronização de etiquetas e oportunidades.
- Campanhas e pausa/parada segura.
- Chat com IA, fila durável, histórico e Central de Execução.
- Google Drive e memória estruturada.
- Telemetria e preferências de consentimento.

## Dependência do painel
O painel/backend deve ser atualizado com o contrato em `docs/CONTRATO_PAINEL_LICENCAS_v1.2.4.md`. A validação automatizada local não comprova que o backend esteja emitindo tokens compatíveis. Testar com tokens reais de cada plano antes de homologar.
