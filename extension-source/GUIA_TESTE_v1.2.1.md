# Guia de teste manual — i9Hub 1.2.1 (Fase 4)

## 1. Abrir inteligência comercial
1. Abra o CRM e clique em **Inteligência comercial**.
2. Clique em **Atualizar análise**.
3. Confirme que os totais e as tabelas são carregados ou que a interface informa claramente a falta de dados.

## 2. Comparar nichos e subnichos
1. Use campanhas que tenham envios registrados e leads classificados.
2. Confira envios, respostas, taxas de resposta, qualificados, taxa de qualificação e leads quentes.
3. Confirme que as taxas agregadas são ponderadas pelo volume de envios.
4. Se algum relatório estiver indisponível, confira o indicador de relatórios sem acesso.

## 3. Comparar personalidades da IA
1. Crie ou selecione campanhas com perfis diferentes (por exemplo, Networking e Comercial).
2. Execute pequenos lotes autorizados e atualize os relatórios após sincronizar as conversas.
3. Abra **Desempenho por personalidade da IA**.
4. Confira se as campanhas são agrupadas pelo perfil salvo e se campanhas antigas/sem perfil aparecem como **Perfil global**.
5. Não interprete a diferença como prova de causalidade: mantenha público e horário comparáveis sempre que possível.

## 4. Exportar CSV
1. Clique em **Exportar análise CSV**.
2. Abra o arquivo no Excel ou Google Sheets.
3. Confira os tipos Geral, Nicho, Subnicho e Personalidade IA.
4. Confirme que o arquivo contém apenas métricas agregadas, sem telefone nem conteúdo de mensagens.

## 5. Preparar público
1. Clique em **Público** ou **Preparar público** para um nicho/subnicho.
2. Confira a quantidade de contatos elegíveis e a notificação dos excluídos.
3. Valide que contatos sem telefone válido, Black list, spam e descadastro não foram incluídos.
4. Confirme que a campanha é apenas preparada e não começa a enviar automaticamente.

## 6. Consolidação de subnichos
1. Cadastre dois subnichos com nomes semelhantes sob o mesmo pai.
2. Abra Inteligência comercial e revise a sugestão.
3. Cancele a confirmação e confira que nada foi alterado.
4. Confirme em seguida: o nome de origem deve virar sinônimo, os leads devem ser remapeados e os filhos devem permanecer ligados ao nó canônico.
5. Não deve ser oferecida consolidação entre pais diferentes.

## 7. Validação automatizada
Execute com Node.js 20 ou superior:

```bash
npm run validate
```

A aprovação automatizada não substitui a validação real no Chrome/WhatsApp Web.
