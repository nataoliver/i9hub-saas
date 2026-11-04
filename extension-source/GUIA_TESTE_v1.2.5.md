# Guia de homologação — i9Hub v1.2.5

## 1. Atualização segura

1. No i9Hub atual, abra **Configurações → Dados → Exportar Backup**.
2. Confirme que o backup local foi gerado e que a sincronização do Google Drive está em estado conhecido.
3. Extraia `i9Hub-v1.2.5.zip` em uma pasta temporária.
4. Abra `chrome://extensions` e ative o Modo do desenvolvedor.
5. Atualize os arquivos na mesma pasta da extensão existente e clique em **Recarregar**. Não desinstale a extensão.
6. Atualize as abas do WhatsApp Web e do Google Maps (F5) e abra novamente o painel lateral do i9Hub.

## 2. Google Maps — nome e origem

1. Abra **Extração Google Maps** e faça uma busca pequena, com detalhes ativados.
2. Confirme que o nome apresentado corresponde ao título individual do estabelecimento, e não a rótulos genéricos como “Resultados”.
3. Salve no CRM e abra o card do lead.
4. Confira a origem e a confiabilidade do nome, telefone, endereço, categoria e site.
5. Repita a extração do mesmo estabelecimento para confirmar que a deduplicação não cria um segundo lead quando o ID do lugar ou telefone coincide.
6. Teste um resultado cujo cartão não exponha o título; o slug só deve ser usado como fallback e deve ter confiança inferior.

## 3. WhatsApp — identificação do contato

1. Use uma conversa privada de um contato salvo na agenda do WhatsApp.
2. Sincronize oportunidades privadas e confirme que o nome salvo tem prioridade sobre o nome de perfil.
3. Teste uma conversa sem nome salvo: o nome de perfil pode ser usado com origem e confiança identificadas.
4. Teste uma conversa cujo título seja apenas um número ou placeholder: o número deve permanecer no campo telefone e não ser gravado como nome real.
5. Confirme que grupos não entram no fluxo de oportunidades privadas.
6. Em **Extração Grupos do WhatsApp**, teste participantes do Store e, se necessário, o fallback visual. O nome deve ter origem identificada e um telefone não deve ser tratado como nome.

## 4. Correção manual e proteção

1. Abra um card do CRM.
2. Em **Identidade e dados do lead**, altere o nome e outro campo (por exemplo, telefone ou endereço).
3. Salve e confira que a origem aparece como **Editado manualmente**, com 100% de confiança.
4. Faça nova sincronização do WhatsApp ou nova importação do Maps.
5. Confirme que os campos corrigidos não foram sobrescritos.
6. Se limpar manualmente um campo, confirme que uma sincronização posterior não o preenche novamente.

## 5. Deduplicação

- Mesmo `waChatId`: deve consolidar no mesmo lead.
- Mesmo telefone normalizado: deve consolidar no mesmo lead.
- Mesmo `placeId` do Google Maps: deve consolidar no mesmo lead.
- Mesmo nome + endereço: pode consolidar.
- Mesmo nome + site: pode consolidar.
- Mesmo domínio sem nome/endereço/telefone/ID em comum: não deve consolidar.

## 6. Licença e integração com o painel

A edição manual usa o entitlement `crm.lead.identity_edit`, dependente de `crm.leads`. Até a atualização do painel administrativo, homologue com uma licença administrativa `admin.full_access` ou com token de teste que contenha os dois IDs. Starter/Pro precisarão receber o novo entitlement quando o painel for atualizado.

## 7. Limite da validação

A suíte automatizada desta entrega passou com 256 testes e a verificação estática analisou 113 arquivos JavaScript/MJS. Ainda é necessário executar os cenários acima no Chrome com WhatsApp Web e Google Maps reais antes de distribuir a versão comercialmente.
