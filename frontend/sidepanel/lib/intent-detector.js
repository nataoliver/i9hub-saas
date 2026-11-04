/**
 * i9Hub Classifier 2.0 — Detector de Intenção Determinístico
 */
export const INTENT_VALUES = Object.freeze([
  "comprar","pedir_orcamento","tirar_duvida","agendar",
  "suporte","reclamacao","parceria","cobranca","sem_intencao_identificada"
]);
const GENERIC_PATTERNS = Object.freeze({
  comprar:["quero comprar","fechar pedido","como pago","pix","boleto","cartão","compro","adquirir"],
  pedir_orcamento:["orçamento","orcamento","quanto custa","valor","preço","preco","tabela","cotação","cotacao","simulação","simulacao"],
  tirar_duvida:["dúvida","duvida","pergunta","informação","informacao","como funciona","não entendi","nao entendi","explica"],
  agendar:["agendar","marcar","horário","horario","disponibilidade","visita","reunião","reuniao","encaixe"],
  suporte:["problema","erro","não funciona","nao funciona","ajuda","suporte","bug","falha","travou"],
  reclamacao:["reclamação","reclamacao","insatisfeito","péssimo","pessimo","demora","atraso","descaso","quero falar gerente"],
  parceria:["parceria","representante","revenda","afiliado","distribuidor","fornecedor","b2b"],
  cobranca:["cobrança","cobranca","fatura","boleto atrasado","débito","debito","pendência","pendencia","pagamento atrasado"]
});
function normalizeText(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
function matchPatterns(text,patterns){const n=normalizeText(text);if(!n)return[];return patterns.filter(p=>n.includes(normalizeText(p)));}
export function detectIntent(evidence={},nicheModel=null){
  const texts=[evidence?.firstIncomingText,...(Array.isArray(evidence?.incomingTexts)?evidence.incomingTexts:[])].filter(Boolean);
  const joined=texts.join("\n");
  if(!joined.trim()) return {nome:"sem_intencao_identificada",confianca:0,evidencias:[],fonte:"vazio"};
  const candidates=[];
  if(nicheModel&&nicheModel.intentPatterns){for(const[intent,patterns]of Object.entries(nicheModel.intentPatterns)){if(!INTENT_VALUES.includes(intent))continue;const hits=matchPatterns(joined,patterns);if(hits.length)candidates.push({intent,hits,weight:2.0,source:"niche"});}}
  for(const[intent,patterns]of Object.entries(GENERIC_PATTERNS)){const hits=matchPatterns(joined,patterns);if(hits.length){const ex=candidates.find(c=>c.intent===intent);if(ex){ex.hits=[...new Set([...ex.hits,...hits])];ex.weight=Math.max(ex.weight,2.5);}else{candidates.push({intent,hits,weight:1.0,source:"generic"});}}}
  if(!candidates.length) return {nome:"sem_intencao_identificada",confianca:0,evidencias:[],fonte:"nenhum_padrao"};
  candidates.sort((a,b)=>(b.hits.length*b.weight)-(a.hits.length*a.weight));
  const best=candidates[0];
  const conf=Math.min(0.98,0.4+(best.hits.length*0.15*best.weight));
  return {nome:best.intent,confianca:Number(conf.toFixed(2)),evidencias:best.hits.slice(0,5),fonte:best.source==="niche"?`modelo_${nicheModel?.id||"nicho"}`:"generico"};
}