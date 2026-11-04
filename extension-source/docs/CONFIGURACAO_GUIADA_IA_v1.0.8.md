# i9Hub v1.0.8 — Configuração guiada do Chat com IA

## Fluxo rápido

1. Abra **Chat com IA** no painel lateral do i9Hub.
2. Selecione OpenAI, Anthropic/Claude, Google Gemini ou OpenRouter. A página oficial para criar uma chave abre em uma nova aba automaticamente.
3. Crie uma chave na conta do provedor e copie-a. A chave é gerada pelo provedor; o i9Hub não consegue criar credenciais em nome do usuário.
4. Volte ao i9Hub, cole a chave no campo **Cole aqui a chave gerada pelo provedor** e clique em **Carregar modelos disponíveis**.
5. Autorize o acesso ao domínio do provedor se o Chrome solicitar. Escolha um dos modelos retornados pela API.
6. Clique em **Salvar, autorizar e testar**. Depois que o teste confirmar a conexão, clique em **Ativar Chat com IA** quando estiver pronto para iniciar o atendimento. Se pular a etapa de carregar modelos, o botão de teste tentará consultá-los automaticamente.

## Valores preenchidos automaticamente

- Lista de modelos retornados pelo endpoint oficial do provedor e compatíveis com geração de respostas, conforme a chave utilizada.
- Endpoint de API do provedor; no Google Gemini, o endpoint é montado automaticamente a partir do modelo escolhido na lista.
- Para novos provedores, não é escolhido um nome de modelo fixo: isso evita falhas por modelos descontinuados ou indisponíveis para a conta.
- Instruções comerciais seguras, em português do Brasil.
- Base inicial que proíbe inventar preços, estoque, prazos, descontos ou políticas.
- Nome inicial da empresa e critérios de qualificação padrão.

O usuário pode personalizar o nome da empresa, as instruções e a base de conhecimento depois. Não é obrigatório preencher esses campos para testar a chave.

## Páginas oficiais de criação de chave

- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/settings/keys
- Google Gemini: https://aistudio.google.com/app/apikey
- OpenRouter: https://openrouter.ai/keys

A disponibilidade de créditos gratuitos, preços, cobrança e limites depende da conta, do modelo e do provedor. Não compartilhe a chave da API. Ela fica armazenada localmente no perfil do Chrome e é enviada ao endpoint do provedor escolhido para as solicitações autorizadas.

## Provedor personalizado

Ao selecionar **Outro (compatível com OpenAI)**, a extensão não abre uma página universal, pois cada serviço tem seu próprio painel. Informe o endpoint HTTPS e o nome exato do modelo fornecidos pelo serviço. A listagem automática só funciona com provedores que disponibilizam uma API de catálogo conhecida.


## Sincronização da configuração da IA entre computadores

As preferências do Chat com IA são incluídas automaticamente no backup do Google Drive quando a sincronização está conectada: provedor, modelo, modo de conversa, instruções, base de conhecimento e critérios de qualificação. Em um computador novo, conecte a mesma conta do Google Drive e sincronize os dados. O atendimento permanece desativado até que o provedor seja testado e autorizado naquele computador.

Por segurança, chaves API não são gravadas em texto aberto no backup. Para restaurar também as chaves sem copiá-las novamente:

1. No computador original, abra **Chat com IA** e localize **Sincronização da IA entre computadores**.
2. Crie uma senha de sincronização com pelo menos 10 caracteres e clique em **Salvar senha e sincronizar**.
3. No outro computador, conecte a mesma conta do Google Drive e abra o Chat com IA.
4. Digite a mesma senha de sincronização e clique em **Salvar senha e sincronizar** para descriptografar as chaves.

A senha de sincronização fica no armazenamento local do perfil do Chrome e nunca é enviada ao Drive. Guarde-a com segurança: se esquecê-la, o i9Hub não consegue descriptografar o backup das chaves. As preferências não secretas continuam disponíveis no Drive mesmo sem essa senha.
