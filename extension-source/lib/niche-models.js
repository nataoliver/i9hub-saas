/**
 * i9Hub Classifier 2.0 — Modelos por Nicho
 */
const NICHE_MODELS = Object.freeze({
  contabilidade: {
    id: "contabilidade", nome: "Contabilidade", versao: "1.0",
    keywords: ["abertura de empresa","imposto","folha","contador","declaracao","multa","cnpj","mei","simples nacional","lucro real","irpf","dirf"],
    intentPatterns: {
      pedir_orcamento: ["orcamento contabil","quanto custa abrir empresa","valor mensalidade","cotacao contador"],
      tirar_duvida: ["como declarar","prazo imposto","documentos necessarios","como funciona mei"],
      suporte: ["erro declaracao","problema cnpj","multa recebida","notificacao receita"],
      agendar: ["agendar reuniao","visita escritorio","reuniao consultoria"]
    },
    urgencySignals: ["prazo fiscal","vencimento imposto","multa hoje","fiscalizacao","bloqueio cnpj"],
    spamSignals: ["dinheiro facil","renda extra sem trabalho","ganhe dinheiro em casa"],
    weights: { prospectBase: 1.2, spamThreshold: 0.9 }
  },
  dentistas: {
    id: "dentistas", nome: "Dentistas", versao: "1.0",
    keywords: ["consulta","dor","aparelho","implante","avaliacao","emergencia","canal","clareamento","ortodontia","protese","extracao"],
    intentPatterns: {
      agendar: ["marcar consulta","agendar avaliacao","horario dentista","encaixe urgente"],
      tirar_duvida: ["quanto tempo demora","doi muito","como cuidar","pos-operatorio"],
      comprar: ["quero fazer implante","fechar tratamento","aceito orcamento"],
      suporte: ["dor apos procedimento","aparelho quebrou","inflamacao","sangramento"],
      reclamacao: ["nao gostei resultado","dor persistente","atraso atendimento"]
    },
    urgencySignals: ["dor intensa","dor forte","inchaco","sangramento","emergencia dental","quebrei dente","dor insuportavel"],
    spamSignals: ["clique aqui promocao","desconto imperdivel saude"],
    weights: { prospectBase: 1.3, spamThreshold: 0.85 }
  },
  advogados: {
    id: "advogados", nome: "Advogados", versao: "1.0",
    keywords: ["processo","consulta juridica","prazo","audiencia","contrato","acao","indenizacao","trabalhista","divorcio","inventario","criminal"],
    intentPatterns: {
      pedir_orcamento: ["custo advogado","valor consulta","honorarios","quanto cobra"],
      agendar: ["agendar consulta","reuniao juridica","visita escritorio"],
      tirar_duvida: ["tenho direito","como funciona processo","prazo prescricao","documentos necessarios"],
      suporte: ["andamento processo","status audiencia","decisao juiz","prazo recurso"],
      cobranca: ["boleto honorarios","pagamento atrasado","acordo financeiro"]
    },
    urgencySignals: ["prazo fatal","audiencia amanha","liminar urgente","prisao","bloqueio judicial","despejo","intimacao prazo"],
    spamSignals: ["ganhe causa garantida","dinheiro rapido processo"],
    weights: { prospectBase: 1.1, spamThreshold: 0.9 }
  },
  varejo_roupas: {
    id: "varejo_roupas", nome: "Varejo de Roupas", versao: "1.0",
    keywords: ["preco","tamanho","cor","disponibilidade","frete","troca","devolucao","colecao","promocao","estoque","modelagem"],
    intentPatterns: {
      comprar: ["quero comprar","fechar pedido","como pago","pix","cartao","boleto"],
      pedir_orcamento: ["quanto custa","valor frete","tem desconto","preco atacado"],
      tirar_duvida: ["serve tamanho","tecido qual","medidas peca","cor real"],
      suporte: ["produto chegou errado","defeito roupa","trocar tamanho","reembolso"],
      reclamacao: ["atraso entrega","produto diferente foto","ma qualidade"]
    },
    urgencySignals: ["preciso hoje","evento amanha","presente urgente","viagem semana"],
    spamSignals: ["replica marca","falsificado barato","golpe oferta"],
    weights: { prospectBase: 1.0, spamThreshold: 1.0 }
  },
  vendas_recorrentes: {
    id: "vendas_recorrentes", nome: "Vendas Recorrentes", versao: "1.0",
    keywords: ["reposicao","recorrencia","assinatura","renovar","mensalidade","plano","upgrade","downgrade","cancelar","pausar"],
    intentPatterns: {
      comprar: ["renovar assinatura","upgrade plano","adicionar usuario","contratar modulo"],
      suporte: ["erro cobranca","nao recebi acesso","problema login","funcionalidade bug"],
      reclamacao: ["aumento preco","servico instavel","suporte demorado"],
      cobranca: ["fatura atrasada","boleto vencido","debito pendente","negociar divida"],
      tirar_duvida: ["como cancelar","periodo carencia","tem fidelidade","como pausar"]
    },
    urgencySignals: ["vence hoje","corte servico","perdi acesso","cobranca indevida"],
    spamSignals: ["cancele gratis agora","golpe renovacao"],
    weights: { prospectBase: 1.1, spamThreshold: 0.95 }
  },
  imobiliaria: {
    id: "imobiliaria", nome: "Corretora de Imoveis", versao: "1.0",
    keywords: ["comprar","alugar","visitar","financiamento","bairro","quartos","entrada","condominio","iptu","metragem","garagem","varanda"],
    intentPatterns: {
      agendar: ["visitar imovel","agendar visita","ver apartamento","conhecer casa"],
      pedir_orcamento: ["valor aluguel","preco venda","condominio quanto","entrada minima"],
      tirar_duvida: ["aceita financiamento","tem garagem","pet friendly","documentacao ok"],
      comprar: ["quero fazer proposta","fechar negocio","sinal entrada","reservar imovel"],
      suporte: ["problema contrato","manutencao imovel","vizinho barulho","vazamento"]
    },
    urgencySignals: ["mudanca urgente","despejo","preciso mudar hoje","contrato vence","imovel disponivel ate"],
    spamSignals: ["investimento garantido imovel","lucro certo construcao"],
    weights: { prospectBase: 1.2, spamThreshold: 0.9 }
  },
  personalizado: {
    id: "personalizado", nome: "Personalizado", versao: "1.0",
    keywords: [], intentPatterns: {}, urgencySignals: [], spamSignals: [],
    weights: { prospectBase: 1.0, spamThreshold: 1.0 }
  }
});
export function getNicheModel(nicheId) {
  const id = String(nicheId || "").trim().toLowerCase();
  return NICHE_MODELS[id] || NICHE_MODELS.personalizado;
}
export function listNicheModels() {
  return Object.values(NICHE_MODELS).map((m) => ({ id: m.id, nome: m.nome, versao: m.versao }));
}
export { NICHE_MODELS };
