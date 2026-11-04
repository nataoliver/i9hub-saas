# i9Hub 1.1.5 — Relatórios e acompanhamento de campanhas

## Fase 3 aplicada
- Relatório individual por campanha com contatos selecionados, enviados, falhas, ignorados, pendentes, taxa de sucesso, respostas identificadas, taxa de resposta, leads qualificados, qualificados que responderam e leads quentes.
- Agrupamento de resultados por nicho e subnicho.
- Listas separadas de quem respondeu, leads qualificados, contatos sem resposta registrada, contatos sem dados suficientes para atribuição, falhas e pendências.
- Exportação para PDF usando a janela de impressão do Chrome; o usuário pode selecionar **Salvar como PDF**.
- Atualização manual do relatório com as informações mais recentes do CRM.
- Registro manual de marcos 24h e 48h depois da conclusão, quando o prazo estiver cumprido.
- Snapshots agregados automáticos programados para 24h e 48h após a conclusão da campanha. Os alarmes são reconstruídos ao iniciar ou atualizar a extensão.
- Histórico de snapshots por campanha e ciclo de execução. Ao retomar uma campanha concluída com contatos pendentes, um novo ciclo de relatório é iniciado, sem apagar os snapshots anteriores.
- Data individual de envio registrada nos contatos a partir desta versão; para campanhas antigas, o relatório tenta recuperar a data pelos logs e pelo último envio conhecido do lead.
- Os relatórios não armazenam conteúdo bruto de mensagens. Contatos sem CRM ou sem data de envio rastreável são marcados como dados insuficientes.

## Limites e observações
- A detecção de respostas depende das evidências que o WhatsApp/CRM já sincronizou. O snapshot automático não força uma leitura histórica de todas as conversas.
- Antes de interpretar "sem resposta registrada" como ausência real de resposta, sincronize as conversas privadas relevantes no CRM.
- O Lead Score é recalculado com os dados e critérios atuais; novos dados podem alterar a qualificação em atualizações posteriores.
- A exportação PDF abre a janela de impressão do Chrome; escolha **Salvar como PDF** para criar o arquivo.
- Os snapshots automáticos dependem de o Chrome voltar a executar a extensão; alarmes pendentes são recuperados no próximo início do navegador.

## Validação
- `npm run check`
- `npm test`
- Testes novos: métricas de campanha, atribuição temporal de respostas, nichos/subnichos, snapshots agregados, ações de relatório e agendamento 24h/48h.
