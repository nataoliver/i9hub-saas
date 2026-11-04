# i9Hub 1.0.8 — Status do Chat com IA e histórico

## Status do atendimento

O painel do Chat com IA apresenta um indicador persistente com estados distintos:

- **IA não conectada:** falta uma chave/modelo válido ou o teste do provedor ainda não foi concluído.
- **Atendimento pausado:** configuração pronta, mas a IA não responde.
- **Aguardando conexão do WhatsApp:** o atendimento foi ativado, mas o WhatsApp Web não está conectado.
- **Aguardando painel aberto:** o painel não enviou heartbeat recente.
- **IA ativa:** provedor testado, atendimento ligado, WhatsApp conectado e painel ativo.

O controle de ativação é único: o mesmo botão alterna entre ativar e pausar. O status é atualizado periodicamente.

## Mensagens privadas e grupos

O observador verifica novas mensagens na lista de conversas e pode abrir a conversa elegível para ler as mensagens textuais novas. O tipo de conversa respeita a configuração do usuário. As mensagens detectadas em uma mesma execução são encaminhadas sequencialmente; a extensão espera a confirmação de processamento antes de trocar para outra conversa. Um rascunho já digitado pelo usuário impede a troca automática para não interromper a escrita.

Em grupos, o modo de resposta configurado pelo usuário continua sendo respeitado: todas as mensagens, ou apenas menções/respostas relevantes. O limite de volume continua ativo para evitar respostas em excesso.

## Histórico no Google Drive

Na seção **Histórico das conversas no Google Drive**, clique em **Criar / conectar histórico** e autorize o Google Sheets. A extensão cria ou reconecta a planilha **i9Hub — Histórico de conversas IA**, com a aba **Mensagens**.

As colunas registram ID do evento, data/hora, ID pseudonimizado da conversa, nome da conversa, tipo, remetente, direção, conteúdo, status, provedor, modelo e detalhes. O histórico inclui mensagens recebidas elegíveis, respostas da IA e erros de processamento. O texto das mensagens pode conter dados pessoais; o registro é opcional e pode ser pausado.

Os registros entram primeiro numa fila local persistente e são enviados em lotes para a planilha. Falhas de rede ou de permissão mantêm os registros pendentes e aparecem no status do histórico. Ao usar outro computador, conecte a mesma conta Google e autorize o acesso à planilha. Se o histórico local da conversa estiver vazio, o i9Hub tenta recuperar as últimas mensagens da planilha para contextualizar a resposta.

## Observações

- A planilha é um histórico e uma fonte de recuperação de contexto; não é um banco transacional para múltiplos computadores gravarem simultaneamente sem conflitos.
- A automação depende do WhatsApp Web e de sua interface, não da API oficial do WhatsApp.
- Mensagens antigas já existentes antes de o observador iniciar não são reprocessadas automaticamente como se fossem novas.


## Inteligência Comercial do Lead (build 1.0.9.1)

Ao conectar a planilha, a extensão mantém duas abas: `Mensagens` (eventos originais) e `Leads` (uma linha por lead). A IA atualiza o card do CRM com pedido exato, resumo comercial, necessidade, serviço, segmento, intenção, orçamento, prazo, objeções, evidências, informações pendentes e próxima ação. A aba `Leads` é atualizada pela chave estável do lead, evitando uma linha nova por mensagem. Se o Google Sheets estiver temporariamente indisponível, a atualização fica em fila local para nova tentativa.
