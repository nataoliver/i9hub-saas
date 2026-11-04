# i9Hub v1.0.6 — Correção do nome dos leads do Google Maps

## Correção principal
- O extrator não depende mais exclusivamente do `aria-label` do link, que em algumas versões do Google Maps pode conter o título genérico **“Resultados”**.
- O nome é obtido primeiro do `aria-label`/`title` individual quando válido, depois do título dentro do cartão de resultado e, como último recurso, do slug do link individual `/maps/place/...`.
- O nome do painel de detalhes só é aceito quando corresponde ao nome identificado no cartão, evitando que um título genérico ou o painel de outro estabelecimento seja associado ao lead.
- Resultados sem nome confiável são ignorados com aviso, em vez de serem gravados no CRM com “Resultados”.
- A ação **Salvar no CRM** inclui uma proteção adicional contra nomes genéricos.

## Preservado
- Telefones, categorias, endereços, sites, avaliações, URL/ID do lugar e origem Google Maps.
- Deduplicação, histórico de extração, limite de leads, busca por raio e demais módulos.
- Licenciamento, catálogo de permissões, campanhas e sincronização WhatsApp.

## Arquivos desta correção
- `content/maps-name.js` — helpers de identificação/validação do nome.
- `content/maps-extractor.js` — extração do nome real e descarte de títulos genéricos.
- `background/service-worker.js` — injeta o helper antes do extrator, inclusive em reinjeção dinâmica.
- `manifest.json` — carrega o helper antes do extrator no Google Maps.
- `sidepanel/components/MapsView.js` — impede salvar resultados sem nome válido.
- `test/maps-name-extraction.test.js` — testes de regressão para o problema observado.

## Limitação
Os testes automatizados cobrem os seletores, o fallback e a proteção contra “Resultados”. Como o DOM do Google Maps pode variar conforme idioma e rollout, é necessário confirmar em uma sessão real do Chrome que o título do cartão está disponível para a busca utilizada.
