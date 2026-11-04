# Guia de teste manual — i9Hub 1.1.6

## 1. Abrir painel de inteligência
- Abra o CRM e clique em **Inteligência comercial**.
- Confirme que a janela mostra estado de carregamento e depois métricas ou mensagem clara de falta de dados.
- Em uma conta sem campanhas com envios, a tela deve informar que a amostra é insuficiente sem gerar percentuais enganosos.

## 2. Comparar nichos
- Use campanhas que tenham contatos enviados e leads classificados.
- Compare envios, respostas, taxa de resposta, qualificados, taxa de qualificação, leads quentes e campanhas com dados.
- Confirme que as taxas são ponderadas pelos envios e não pela média simples das taxas de cada campanha.
- Se uma campanha não tiver relatório acessível, a tela deve indicar que houve relatório indisponível.

## 3. Recomendações
- Com amostra inferior a 5 envios, deve aparecer uma orientação para coletar mais dados.
- Segmentos com taxa de resposta maior que a média podem receber recomendação para novo teste.
- Segmentos abaixo da média recebem recomendação para revisar abordagem e origem, sem afirmar que o nicho é ruim.
- A tela deve informar que as sugestões dependem dos dados sincronizados e não garantem resultados.

## 4. Preparar público
- Clique em **Público** ou **Preparar público** para um nicho/subnicho.
- O formulário de campanha deve abrir com os contatos classificados naquele segmento.
- Contatos sem telefone válido, na Black List ou marcados como spam não devem ser incluídos nessa seleção.
- Verifique as opções e os filtros de segurança antes de iniciar qualquer campanha.

## 5. Consolidar subnichos
- Cadastre dois subnichos de nomes muito semelhantes sob o mesmo nicho pai.
- Abra Inteligência comercial e confira a sugestão de consolidação.
- Clique em **Consolidar** e cancele a confirmação: nada deve mudar.
- Repita e confirme: o nome de origem deve ser preservado como sinônimo, os leads devem continuar no CRM e as referências de classificação devem apontar para o nó canônico.
- Não deve ser oferecida consolidação automática entre classificações com pais diferentes.

## 6. Validação automatizada
Execute com Node.js 20 ou superior:

```bash
npm run validate
```

Resultado desta build: verificação de sintaxe concluída e 190 testes aprovados. O teste manual em Chrome/WhatsApp Web continua necessário.
