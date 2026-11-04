# Guia de teste — i9Hub 5.4.1

1. Instale a pasta extraída em `chrome://extensions` com Modo do desenvolvedor.
2. Ative uma licença de teste que inclua `whatsapp.connection`.
3. Com o WhatsApp Web já aberto e conectado em outra aba, clique em **Abrir WhatsApp** no menu. A extensão deve reutilizar a aba e abrir a janela ao lado, sem criar duplicata.
4. Repita sem uma aba aberta: o WhatsApp deve abrir para login/QR code.
5. Confira que a tela de conexão apresenta estados distintos: não aberto, carregando, QR code, conectado ou erro.
6. Confira que **Marketing & Dados** não aparece no menu nem pode ser acessado por `#growth`.
7. Abra a apresentação com uma licença de poucos recursos: só devem aparecer passos correspondentes a recursos liberados e gerais.
8. Clique em **Conhecer todos os módulos**: deve ser apenas explicativo e não deve abrir rotas ou pop-ups de bloqueio.
9. Nas Configurações, confirme que telemetria começa desativada. Salvar sem consentimento não deve enviar eventos ao backend. Ative e salve somente se desejar compartilhar métricas operacionais.
10. Com uma campanha de anúncio ativa no painel e uma licença elegível, confirme que o rodapé continua visível ao trocar de tela. Verifique imagem, título, texto, link e botão.
11. Teste a extensão em painel estreito e janela de desktop.

## Resultado esperado
- Nenhuma função operacional deve funcionar sem licença e entitlement explícito.
- A ausência de licença deve gerar explicação/CTA, não erro silencioso.
- O conteúdo do anúncio deve vir da configuração pública do backend, sem HTML/JavaScript remoto.
