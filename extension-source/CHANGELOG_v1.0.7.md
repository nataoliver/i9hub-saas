# Changelog — i9Hub v1.0.7

## Remoção do módulo de campanhas não utilizado
- Removido o botão de campanha adicional do CRM.
- Removidos a rota, a tela, os métodos de API, os handlers de envio e as referências na Ajuda e no tutorial.
- Mantido o identificador de entitlement legado no catálogo para compatibilidade com licenças emitidas anteriormente; ele fica desativado e não aparece na interface.
- Mantida a permissão do domínio do painel de licenciamento, pois esse host também atende a validação de licença.

## Responsividade do CRM/Kanban
- Botões dos cartões agora quebram linha e ocupam no máximo a largura interna do cartão.
- Nomes longos, telefones, categorias e etiquetas podem quebrar linha sem ampliar o cartão.
- Filtros, ações e estatísticas se reorganizam em telas estreitas.
- Colunas do Kanban mantêm rolagem horizontal sem permitir que o conteúdo interno transborde.

## Versão
- Versão comercial: `1.0.7`
- Versão técnica Chrome: `1.0.7.0`

## Correções de interface e apresentação
- Renomeados os itens do menu para **Extração Google Maps** e **Extração Grupos do WhatsApp**.
- Atualizados os títulos das telas, atalhos, ajuda e apresentação guiada para usar os mesmos nomes.
- Revisada a apresentação para descrever somente os módulos e recursos presentes na versão comercial `1.0.7`, removendo referências a módulos que não fazem parte desta build.
- Mantida a versão comercial `1.0.7` e a versão técnica `1.0.7.0`.

## Compatibilidade técnica
- Os nomes de protocolo e chaves de armazenamento antigos usados internamente pelas pontes do WhatsApp e pelo licenciamento foram preservados para não quebrar sessões ou dados existentes. Eles não são exibidos na interface.
- Rótulos de diagnóstico e logs internos foram renomeados para i9Hub.
