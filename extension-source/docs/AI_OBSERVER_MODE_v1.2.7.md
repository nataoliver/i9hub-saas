# IA observadora — i9Hub v1.2.7

## Finalidade

A IA observadora lê mensagens recebidas nas conversas autorizadas, identifica informações profissionais/comerciais e atualiza o card do lead. Ela não conversa com o contato e não executa ações de atendimento.

## Configuração

O modo é configurado individualmente em cada personalidade:

- `auto_reply`: mantém o atendimento automático existente.
- `observe_only`: analisa e registra informações no CRM, sem enviar mensagens.

O modo observador é permitido para personalidades **Comercial** e **Networking**. Não é permitido em **Autoconhecimento**, para impedir que reflexões pessoais sejam levadas ao CRM.

## Dados que podem ser registrados

Conforme evidência explícita na conversa:

- empresa e atividade profissional;
- nicho e subnicho;
- produto/serviço de interesse;
- necessidade e pedido explícito;
- intenção comercial;
- orçamento comercial relacionado à contratação;
- prazo e urgência;
- poder de decisão;
- objeções;
- informações pendentes;
- próxima ação comercial sugerida;
- resumo e evidências curtas.

A IA não deve inferir dados ausentes. O nível de confiança deve refletir a qualidade da evidência.

## Proteção de privacidade

O prompt orienta o modelo a ignorar dados pessoais sensíveis que não sejam necessários à relação profissional/comercial, como saúde, religião, opinião política, raça/etnia, orientação sexual, vida íntima e situação financeira pessoal. O campo de orçamento se refere apenas ao orçamento comercial explicitamente associado à contratação.

As atividades do histórico do CRM registram os nomes dos campos atualizados e a confiança, não o texto bruto da conversa nem o telefone.

O contexto necessário da conversa é mantido localmente na extensão para continuidade da análise e enviado ao provedor de IA configurado pelo usuário. O provedor pode ter suas próprias regras de retenção e cobrança. O histórico bruto em Google Sheets continua sujeito à opção de histórico que o usuário ativou separadamente.

## Ações explicitamente proibidas no modo observador

- responder ao contato;
- enviar mensagem ao vendedor;
- criar pedido;
- criar handoff;
- executar mensagem de fallback em erro;
- enviar aviso de rate limit ao contato;
- mover o lead de estágio;
- disparar follow-up ou campanha.

O modo observador continua respeitando os controles de conversa privada/grupo e a lista/escopo de grupos autorizados. Os gatilhos de resposta de grupo (menção, resposta ou palavra-chave) não se aplicam à observação, pois não há resposta a enviar.

## Atualização do CRM

O modo observador usa os campos estruturados `aiIntelligence` e `aiQualification`. Quando detectar mudança relevante, acrescenta um evento `ai.observation.updated` em `activityLog`, que aparece na linha do tempo do card. As anotações manuais do vendedor (`notes`) permanecem independentes e não são alteradas.

O modo observador não muda `lead.stage`. A classificação pode indicar uma situação comercial, mas a movimentação do funil permanece sob controle humano.

## Licenciamento

Novo entitlement:

`ai.mode.observe_only`

Dependências:

- `whatsapp.ai_support`
- `crm.leads`

O catálogo canônico da extensão está na versão 5. A funcionalidade está marcada como implementada na extensão. O painel administrativo ainda precisa receber o mesmo ID para permitir sua seleção por plano e emissão nos tokens.

## Operação

A extensão depende do Chrome aberto, do painel lateral ativo, do WhatsApp Web conectado e do heartbeat do i9Hub. Se o computador/navegador fechar, a análise não acontece até a operação voltar.
