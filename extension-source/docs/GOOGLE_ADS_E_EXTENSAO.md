# Google Ads / AdSense na extensão i9Hub

## Recomendação
Não carregar o script do Google AdSense diretamente no HTML do side panel da extensão. Páginas de extensão MV3 têm restrições de Content Security Policy e de código remoto; além disso, o AdSense é destinado a propriedades web elegíveis, não a um slot nativo de extensão.

## Caminho recomendado
- Na extensão: usar o slot de rodapé nativo controlado pelo painel administrativo, com imagem, título, texto, CTA, URL HTTPS, datas e segmentação. Esse espaço pode promover o próprio i9Hub, módulos, ofertas ou patrocinadores autorizados.
- No site hospedado: usar Google AdSense ou os produtos de anúncios apropriados, após verificar os requisitos de elegibilidade e políticas do Google.
- Para medir conversões da extensão: encaminhar eventos permitidos pelo usuário ao backend e, de lá, integrar com os provedores compatíveis. Não inserir scripts de terceiros no WhatsApp Web nem executar código remoto dentro da extensão.

## Diferença de termos
- **Google Ads:** plataforma para anunciar produtos e serviços para outras pessoas. Não é, por si só, um componente para exibir anúncios dentro da extensão.
- **Google AdSense:** monetização de conteúdo em propriedades web elegíveis.
- **Slot de anúncio do i9Hub:** componente nativo da extensão, controlado pelo painel, sem dependência de script de anúncio remoto.
