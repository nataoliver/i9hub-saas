# Arquitetura de identidade dos leads — i9Hub v1.2.5

## 1. Estrutura dos metadados

Cada campo de identidade pode manter metadados independentes dentro de `lead.identityMeta`:

```json
{
  "name": {
    "source": "google_maps_details",
    "confidence": 0.99,
    "observedAt": "2026-10-30T12:00:00.000Z",
    "manual": false,
    "locked": false,
    "cleared": false
  }
}
```

Campos contemplados: `name`, `phone`, `email`, `company`, `category`, `address` e `website`.

`confidence` é um indicador de confiabilidade da extração, não uma probabilidade estatística de que o dado seja verdadeiro. `manual` e `locked` indicam uma correção/decisão do usuário que não deve ser substituída por novas extrações. `cleared` registra que o usuário limpou intencionalmente o campo.

## 2. Fontes reconhecidas

- WhatsApp: contato salvo, nome comercial verificado, nome formatado, nome de perfil, título da conversa e telefone resolvido pelo Store.
- Google Maps: título dos detalhes, título do cartão, rótulo acessível, slug da URL, telefone, endereço e site do perfil.
- Manual: valor editado ou limpo pelo usuário.
- Importação: dados importados sem uma fonte mais específica.
- Unknown: legado ou origem que não pôde ser inferida.

## 3. Regra de mesclagem

1. Correção manual bloqueada prevalece sobre qualquer fonte automática.
2. Campo manualmente limpo permanece vazio mesmo que uma sincronização futura encontre valor.
3. Valor automático válido substitui placeholder ou valor inválido.
4. Entre dois valores automáticos diferentes, o de confiança superior prevalece; diferenças inferiores a 0,02 não substituem o atual.
5. Valor equivalente mantém o dado atual e pode elevar os metadados de origem/confiabilidade.
6. Campos vazios recebidos automaticamente não apagam dados existentes.

## 4. Chaves de identidade e deduplicação

Ordem de correspondência:

1. `waChatId` normalizado.
2. `placeId` / identificador de lugar do Google Maps.
3. Telefone normalizado (10/11 dígitos brasileiros recebem DDI 55).
4. Nome + endereço normalizados.
5. Nome + site normalizados.

O domínio do site sozinho não é chave de deduplicação, pois empresas diferentes podem compartilhar um domínio institucional ou de franquia. Quando nome + site coincidem, mas os dois endereços estão preenchidos e divergem, unidades distintas não são consolidadas.

## 5. Fluxos

- WhatsApp Web (MAIN world) seleciona o melhor candidato de nome e envia os metadados ao content bridge.
- Google Maps (isolated world) associa a origem/confiança ao nome e aos campos extraídos.
- Service Worker aplica o mesmo resolvedor ao mesclar dados e ao deduplicar leads.
- Card do CRM apresenta origem/confiança e envia correções por `UPDATE_LEAD_IDENTITY`.

## 6. Autorização

`UPDATE_LEAD_IDENTITY` exige `crm.lead.identity_edit`, que depende de `crm.leads`. O entitlement está ativo no catálogo v3 da extensão. O painel administrativo precisa emitir o novo ID aos planos comerciais que receberem a função.
