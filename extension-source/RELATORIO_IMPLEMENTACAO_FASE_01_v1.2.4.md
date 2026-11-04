# Relatório de implementação — Fase 01 | i9Hub v1.2.4

## Base utilizada
- Pacote original: `i9Hub-v1.2.3(1).zip`.
- Versão de origem: comercial `1.2.3`, técnica `1.2.3.0`.
- Entrega desta fase: comercial `1.2.4`, técnica `1.2.4.0`.
- O pacote original foi mantido intacto; as alterações foram aplicadas em uma cópia de trabalho.

## O que foi implementado

### Arquitetura
- `lib/feature-catalog.js`: catálogo canônico atualizado para a versão 2.
- `lib/module-registry.js`: registro de 17 módulos derivado do catálogo; o registro organiza o produto, mas não concede permissões.
- `lib/license-policy.js`: política compartilhada para autorização, dependências, configurações, privilégios administrativos e normalização dos limites assinados.
- `background/service-worker.js`: delega a decisão de autorização à política central e informa versões do contrato/catálogo, módulos e limites no status da licença.
- `sidepanel/sidepanel.js` e `sidepanel/utils/api.js`: utilizam a mesma política de permissões para a interface e para pré-validação de campanhas.

### Catálogo e dependências
- Os 74 IDs originais foram preservados, sem remoção.
- Foram reservados 10 IDs para as fases seguintes da v1.3.0.
- O catálogo agora contém 84 entradas: 73 implementadas, 1 entrada legada não implementada (`rcs.campaigns`) e 10 entradas planejadas.
- Os 10 IDs planejados permanecem `implemented: false`; não podem ser liberados por entitlement direto, wildcard ou `admin.full_access`.
- Dependências de funcionalidades são avaliadas recursivamente e com proteção contra ciclos.
- IDs desconhecidos e funcionalidades não implementadas são negados.

### Licenciamento e segurança
- Não há mais ações operacionais core liberadas sem licença (`CORE_ACTIONS` está intencionalmente vazio).
- O modo de demonstração permite explorar a interface, mas não executar operações comerciais nem acessar dados operacionais.
- Ações públicas limitadas à ativação, status e metadados permanecem disponíveis.
- Ações de segurança continuam disponíveis para pausar/parar operações, desconectar o Drive e registrar opt-in/opt-out.
- A captura passiva de oportunidades privadas e a entrada passiva de mensagens para a fila de IA agora verificam a licença antes de persistir dados.
- O início, retomada e reenvio de campanhas exigem simultaneamente permissão de envio e conexão com WhatsApp.
- `CONSENT_UPDATE` foi associado ao entitlement semanticamente correto (`compliance.consent_tracking`) e permanece como ação de segurança.
- `admin.full_access` não é inferido por `*` ou `all`; somente o ID explícito concede o privilégio completo sobre funcionalidades já implementadas.

### Contrato de licença
- Formato do token Ed25519, chave pública `k1`, vínculo por dispositivo, claims existentes, ID da extensão e OAuth foram preservados.
- O status da licença agora expõe `featureCatalogVersion`, `licenseContractVersion`, `modules` e `limits` normalizados.
- Limites aceitos no cliente são somente valores escalares finitos não negativos (números ou booleanos). A aplicação de limites operacionais específicos deverá ser feita por cada módulo/backend.
- A tolerância offline atual de até sete dias foi preservada para não alterar o comportamento de disponibilidade sem uma alteração coordenada do backend.

## Validação automatizada
- `npm run check`: aprovado — manifesto, sintaxe, imports e 111 arquivos JavaScript/MJS verificados.
- `npm test`: aprovado — 244 testes, 244 aprovados, 0 falhas.
- Verificação de preservação do catálogo: 74 IDs originais presentes; 10 IDs novos planejados; nenhum ID original removido.

## Arquivos centrais criados
- `lib/license-policy.js`
- `lib/module-registry.js`
- `test/architecture-licensing-v1.2.4.test.js`
- `docs/ARQUITETURA_MODULAR_v1.2.4.md`
- `docs/CONTRATO_PAINEL_LICENCAS_v1.2.4.md`
- `GUIA_TESTE_v1.2.4.md`
- `CHANGELOG_v1.2.4.md`
- `INSTALAR-i9Hub-1.2.4.txt`

## Pendências externas / limites desta entrega
1. O repositório do painel/backend não veio dentro do ZIP da extensão. Portanto, o código do painel, `seed.ts`, banco e endpoints não foram alterados. O contrato atualizado para o painel está em `docs/CONTRATO_PAINEL_LICENCAS_v1.2.4.md`.
2. É necessário sincronizar o catálogo v2 no painel e garantir que ele ofereça para seleção somente funcionalidades `implemented: true`.
3. É necessário testar com tokens reais emitidos pelo painel para Starter, Pro e licença do proprietário.
4. A tolerância offline de sete dias continua existente; uma revogação pode não surtir efeito imediato enquanto o dispositivo estiver sem comunicação e dentro dessa janela.
5. A normalização dos limites está pronta, mas limites por volume/uso só serão efetivamente impostos quando os módulos correspondentes forem implementados e conectados ao backend.
6. Os testes automatizados não substituem o teste manual no Chrome com WhatsApp Web e uma conta real de homologação.

## Próxima fase
Fase 02 — identidade e dados do lead: extração confiável, edição manual, origem dos campos, preservação de correções e deduplicação por ID estável.
