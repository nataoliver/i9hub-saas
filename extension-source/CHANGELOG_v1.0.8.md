# Changelog — i9Hub v1.0.8

## Chat com IA e qualificação de leads

- Adicionada a área **Chat com IA** ao menu lateral.
- Configuração de resposta para conversas privadas, grupos ou ambos.
- Nos grupos, o usuário escolhe entre responder a todas as mensagens ou somente quando a mensagem for uma resposta/citação ou mencionar a conta.
- O contexto enviado ao modelo inclui o histórico recente da conversa, o autor da mensagem no grupo e o conteúdo citado quando detectado.
- Adicionado suporte a um provedor principal e até quatro provedores reserva, com rodízio após erros, cotas esgotadas, limites de requisição e indisponibilidade temporária.
- Provedores em limite recebem cooldown temporário para evitar repetir a chamada em cada mensagem. Limites de cota diária recebem janela de espera maior.
- As chaves de API ficam no armazenamento local da extensão e são removidas das respostas de configuração pública. A chave do Gemini é enviada por cabeçalho, não na URL.
- Adicionada qualificação estruturada do lead com nível de confiança, justificativa, necessidade, orçamento, prazo e próximo passo.
- Quando o lead é identificado de forma inequívoca, a IA pode salvar o resumo da qualificação e mover o estágio do CRM para o estágio escolhido, respeitando a licença e protegendo Black list, Fechado e Perdido. O CRM mostra um selo com a confiança da qualificação da IA na tabela e no Kanban.
- Adicionado monitoramento do último provedor utilizado e de erros/espera de provedores.
- Apresentação guiada atualizada para descrever os recursos da versão 1.0.8.
- Mantida a versão comercial `1.0.8` e a versão técnica Chrome `1.0.8.0`.

## Limitações conhecidas

- A detecção automática acompanha mensagens novas na conversa aberta/ativa do WhatsApp Web. Não garante leitura de chats fechados ou execução com o painel fechado.
- A detecção de resposta citada e menção depende dos elementos que o WhatsApp Web expõe no DOM e precisa ser validada manualmente em diferentes tipos de grupo.
- A atualização automática do estágio requer um lead correspondente no CRM e as permissões de CRM adequadas. Se o contato não puder ser identificado sem ambiguidade, o sistema não muda o estágio.
- O rodízio não fornece créditos gratuitos: usa apenas chaves e modelos configurados pelo usuário e sujeitos aos limites de cada provedor.
- Correção de configuração de modelos: a extensão consulta a lista retornada pela chave API do provedor e apresenta modelos compatíveis em um seletor, em vez de depender de nomes de versões fixos.
- Google Gemini: a lista considera apenas modelos que declaram suporte a `generateContent`; o endpoint é montado a partir do modelo selecionado.
- OpenAI, Anthropic e OpenRouter: adicionado carregamento de modelos a partir dos endpoints de catálogo dos respectivos provedores, com tratamento de erros e ocultação da chave em mensagens.
- Adicionado o mesmo seletor dinâmico de modelos para provedores reserva. Provedores personalizados continuam aceitando o nome informado pelo serviço, pois não existe um endpoint universal de catálogo.
- Removidos modelos padrão fixos para novas configurações, evitando selecionar automaticamente modelos antigos ou indisponíveis.


## Correção — sincronização da IA entre computadores

- Preferências do Chat com IA (provedor, modelo, modo privado/grupo, instruções, base de conhecimento e critérios de qualificação) passam a ser incluídas no backup do Google Drive.
- Chaves de API nunca são gravadas em texto aberto no backup. A sincronização opcional das chaves usa AES-GCM-256 com chave derivada por PBKDF2-SHA-256 e uma senha definida pelo usuário.
- A senha de sincronização fica apenas no armazenamento local do perfil do Chrome; no novo computador, o usuário informa a mesma senha para descriptografar as chaves.
- Ao restaurar a configuração da IA em outro computador, o atendimento fica desativado e exige teste/permissões locais antes de ser ativado.
- O sincronizador observa alterações em `aiSupportConfig` e migra a configuração existente para o Drive ao atualizar a extensão.
- A sincronização mescla o backup remoto antes de enviar quando coleções locais estão vazias, reduzindo o risco de sobrescrever dados do outro computador.
