# i9Hub — Guia de Identidade Visual
## Referência para extensão, painel administrativo e divulgação

**Versão:** 1.0 — proposta visual para validação antes da publicação  
**Marca principal:** i9Hub  
**Assinatura:** CRM · Automação · Inteligência Comercial  
**Tagline recomendada:** *Sua operação comercial em um só lugar.*

> Este documento estabelece a direção visual recomendada para o i9Hub. A identidade deve ser considerada oficialmente aprovada somente depois da validação do responsável pelo produto e da verificação de disponibilidade da marca.

## 1. Ideia central da marca

O i9Hub será a marca principal da plataforma. i9Leads, i9Flow, i9Assist e i9Insights são módulos do mesmo ecossistema e devem compartilhar tipografia, espaçamento, ícones, componentes e linguagem visual.

A marca deve transmitir **confiança, tecnologia, clareza, integração, resultados e escalabilidade**. O nome e a identidade não devem ficar limitados ao WhatsApp: CRM, métricas, IA, campanhas e futuras integrações também fazem parte do produto.

**Posicionamento recomendado:** i9Hub — CRM, Automação e Inteligência Comercial.

## 2. Conceito de logo recomendado

- Símbolo compacto baseado no monograma **i9**, com formas geométricas arredondadas.
- Degradê azul para ciano usado de maneira controlada no símbolo.
- Logotipo `i9Hub` em fonte sem serifa, forte e moderna.
- `i9` em azul e `Hub` em azul-marinho sobre fundo claro; versão branca sobre fundo escuro.
- Assinatura opcional: `CRM · Automação · Inteligência Comercial`.
- Tagline `Sua operação comercial em um só lugar.` para materiais de divulgação, não necessariamente dentro da extensão.

O monograma deve funcionar sozinho no ícone do navegador e ao lado do nome completo em painéis, site e redes sociais. Evitar símbolos que limitem a marca a um robô, gráfico ou aplicativo específico.

### Arquivos incluídos no kit

- `logos/svg/i9hub-horizontal-claro.svg` — logo horizontal para fundo claro.
- `logos/svg/i9hub-horizontal-escuro.svg` — logo horizontal para fundo escuro.
- `logos/svg/i9hub-simbolo.svg` — símbolo vetorial.
- `logos/png/i9hub-horizontal-claro.png` — versão raster para uso geral.
- `logos/png/i9hub-horizontal-escuro.png` — versão raster para fundo escuro.
- `icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` — ícones para extensão.
- `social/avatar-1080.png` — avatar quadrado para redes sociais.
- `referencias/prancha_conceito_identidade_i9Hub.png` — prancha conceitual de referência.

**Nota:** a prancha conceitual é uma referência visual. Para produção, prefira os SVG/PNG individuais e valide o desenho em tamanho real.

## 3. Paleta oficial proposta

### Cores principais

| Token | Cor | HEX | Uso |
|---|---|---|---|
| `brand.navy` | Azul-marinho | `#101828` | Base institucional, fundos escuros e textos fortes |
| `brand.blue` | Azul principal | `#2563EB` | Botões primários, links e ações principais |
| `brand.blueBright` | Azul elétrico | `#3B82F6` | Seleção, foco e elementos ativos |
| `brand.cyan` | Ciano tecnológico | `#06B6D4` | IA, integrações e detalhes de inovação |
| `brand.white` | Branco | `#FFFFFF` | Logo sobre fundo escuro e superfícies claras |

### Cores de interface

| Token | HEX | Uso |
|---|---|---|
| `surface.canvas` | `#F8FAFC` | Fundo padrão do painel |
| `surface.card` | `#FFFFFF` | Cards, formulários e painéis |
| `text.primary` | `#0F172A` | Texto principal em modo claro |
| `text.secondary` | `#64748B` | Texto auxiliar e metadados |
| `border.default` | `#E2E8F0` | Bordas e divisórias |
| `surface.dark` | `#0B1220` | Fundo do modo escuro |
| `surface.darkCard` | `#111827` | Cards no modo escuro |
| `border.dark` | `#253247` | Bordas no modo escuro |
| `text.darkPrimary` | `#F1F5F9` | Texto principal no modo escuro |
| `text.darkSecondary` | `#94A3B8` | Texto auxiliar no modo escuro |

### Cores de estado

| Estado | HEX sugerido | Uso |
|---|---|---|
| Sucesso | `#16A34A` | Operação concluída, venda registrada |
| Atenção | `#D97706` | Aguardando resposta, ação necessária |
| Erro | `#DC2626` | Falha ou operação não concluída |
| Informação | `#0284C7` | Avisos informativos |
| IA / automação | `#06B6D4` | Indicadores específicos de IA |

As cores de estado não substituem a cor principal da marca. Use-as apenas quando o significado exigir.

### Gradientes

- **Principal:** `#2563EB` → `#06B6D4`.
- **Secundário opcional:** `#7C3AED` → `#3B82F6`, reservado para campanhas ou destaques especiais.

Use gradientes no símbolo, em pequenas áreas de destaque e em materiais de marketing. Evite degradês fortes em cada card ou botão.

## 4. Cores dos módulos

| Módulo | Função | Cor | HEX |
|---|---|---|---|
| **i9Leads** | CRM, contatos, leads e oportunidades | Azul | `#2563EB` |
| **i9Flow** | Automações e fluxos comerciais | Violeta | `#7C3AED` |
| **i9Assist** | Atendimento com IA | Ciano | `#06B6D4` |
| **i9Insights** | Telemetria, indicadores e resultados | Âmbar | `#D97706` |

As cores dos módulos aparecem em ícones, etiquetas, indicadores e gráficos. Não crie quatro interfaces independentes.

## 5. Tipografia

**Família recomendada:** Inter.

- Títulos: Inter Bold / 700.
- Subtítulos: Inter SemiBold / 600.
- Texto de interface: Inter Regular / 400.
- Botões e etiquetas: Inter Medium / 500.
- Números de indicadores: Inter SemiBold / 600.

Se Inter não estiver disponível, use uma fonte sem serifa compatível com o sistema. Evite fontes decorativas nos painéis.

## 6. Aplicação por contexto

### Dentro da extensão

- Mostrar símbolo compacto e nome `i9Hub` no cabeçalho quando houver espaço.
- Em áreas estreitas, usar apenas o símbolo e oferecer nome em tooltip/rótulo acessível.
- Priorizar uma coluna em side panels estreitos; usar duas colunas somente quando houver largura suficiente.
- Botão primário azul; ações secundárias neutras; alertas com cores de estado.
- Usar bordas suaves, raio consistente e sombras discretas.
- Reservar ciano para IA, integrações e estados tecnológicos.
- Mostrar estados claros de licença, conexão, sincronização, carregamento, sucesso e falha.

### Ícone da extensão no navegador

- Usar somente o monograma/símbolo, sem tagline e sem texto pequeno.
- Fundo azul-marinho `#101828`, símbolo em gradiente azul-ciano.
- Exportar PNG em 16×16, 32×32, 48×48 e 128×128.
- Conferir legibilidade em 16×16; simplificar detalhes se necessário.
- Evitar bordas finas e letras pequenas; testar em temas claros e escuros do navegador.

### Painel administrativo

- Fundo claro `#F8FAFC`, cards brancos e bordas `#E2E8F0`.
- Menu lateral azul-marinho ou neutro, com seleção azul.
- Um botão primário por contexto; evitar ações concorrentes.
- Cards de indicadores com número destacado, rótulo claro e período explícito.
- Estados comerciais consistentes em CRM, IA, telemetria e licenças.
- Tema escuro opcional com tokens próprios, não uma simples inversão de cores.

### Redes sociais

- Avatar: símbolo compacto centralizado, com margem de segurança.
- Post quadrado: logo horizontal ou vertical, título curto e contraste alto.
- Capa: logo, mensagem de posicionamento e espaço livre; evitar excesso de módulos.
- Stories: símbolo e mensagem principal na área central segura.
- Não usar tagline em peças pequenas quando ficar ilegível.
- Manter a mesma paleta e a mesma forma do símbolo em todas as peças.

## 7. Responsividade e experiência do usuário

- Projetar primeiro para a largura real do side panel da extensão.
- Evitar larguras fixas que gerem rolagem horizontal desnecessária.
- Empilhar campos de formulário em telas estreitas.
- Tabelas devem permitir rolagem controlada ou mudar para cartões em telas pequenas.
- Alvos clicáveis precisam ser confortáveis; foco de teclado deve ser visível.
- Animações curtas e leves; respeitar `prefers-reduced-motion` quando possível.
- Exibir feedback claro após ações.
- Funções bloqueadas por licença devem explicar o motivo e mostrar o próximo passo.
- Estados de erro devem sugerir como recuperar a operação.
- Nunca depender apenas da cor para comunicar um estado.

## 8. Uso correto e incorreto da marca

### Fazer

- Manter proporções do símbolo e do logotipo.
- Usar versões clara e escura de acordo com o fundo.
- Garantir contraste e margem livre ao redor da marca.
- Usar símbolo sozinho em espaços pequenos.
- Usar paleta oficial e tipografia recomendada.

### Evitar

- Esticar ou comprimir a logo.
- Trocar cores por tons aleatórios.
- Aplicar sombra pesada, contorno ou brilho excessivo.
- Colocar a logo sobre fundo carregado sem área de proteção.
- Reduzir a tagline até ficar ilegível.
- Dar uma cor completamente diferente a cada tela.
- Usar ícones de terceiros como se fossem parte do símbolo oficial.
- Criar variações não documentadas entre módulos.

## 9. Tokens CSS de referência

```css
:root {
  --i9-brand-navy: #101828;
  --i9-brand-blue: #2563EB;
  --i9-brand-blue-bright: #3B82F6;
  --i9-brand-cyan: #06B6D4;
  --i9-bg: #F8FAFC;
  --i9-surface: #FFFFFF;
  --i9-text: #0F172A;
  --i9-text-muted: #64748B;
  --i9-border: #E2E8F0;
  --i9-success: #16A34A;
  --i9-warning: #D97706;
  --i9-danger: #DC2626;
  --i9-info: #0284C7;
  --i9-radius-sm: 6px;
  --i9-radius-md: 10px;
  --i9-radius-lg: 16px;
  --i9-radius-xl: 24px;
}
```

## 10. Checklist de adoção

- [ ] Aprovar a direção visual e o conceito do monograma i9.
- [ ] Verificar disponibilidade de marca, domínios e identificadores sociais antes de anunciar publicamente.
- [ ] Validar a legibilidade do ícone em 16×16, 32×32, 48×48 e 128×128.
- [ ] Atualizar os ícones no `manifest.json` da extensão.
- [ ] Aplicar tokens de cor e tipografia na extensão.
- [ ] Aplicar os mesmos tokens no painel administrativo.
- [ ] Implementar estados de licença, conexão, erro e sucesso consistentes.
- [ ] Validar contraste e acessibilidade.
- [ ] Testar side panel estreito, notebook e monitor grande.
- [ ] Preparar templates de post, capa e story para redes sociais.
- [ ] Confirmar que os módulos usam cores secundárias sem quebrar a unidade da marca.
- [ ] Manter este documento atualizado quando a identidade mudar.

## Decisão recomendada

Adotar **i9Hub** como marca principal, com monograma `i9` em azul-ciano, logotipo em Inter e paleta azul-marinho/azul/ciano como base. Usar **i9Leads**, **i9Flow**, **i9Assist** e **i9Insights** como nomes internos de módulos.

Esta identidade oferece unidade entre extensão, painel e divulgação, e permite adicionar novas funções sem redesenhar a marca principal.
