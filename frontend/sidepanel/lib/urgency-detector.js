/**
 * i9Hub Classifier 2.0 — Detector de Urgência
 */
export const URGENCY_LEVELS = Object.freeze(["baixa","normal","alta","critica"]);
const GENERIC_URGENCY = Object.freeze({
  critica:["emergencia","emergência","preciso resolver agora","hospital","internado","preso","bloqueio judicial","despejo hoje"],
  alta:["urgente","hoje","agora","amanhã","prazo fatal","vencimento hoje","imediato","não pode esperar","nao pode esperar"],
  normal:["prazo","vencimento","quando fica pronto","entrega","disponibilidade","agenda","essa semana","breve"],
  baixa:["quando puder","sem pressa","futuro","talvez","só curiosidade","so curiosidade","ano que vem"]
});
function normalizeText(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
function matchSignals(text,signals){const n=normalizeText(text);if(!n)return[];return signals.filter(s=>n.includes(normalizeText(s)));}
export function detectUrgency(evidence={},nicheModel=null){
  const texts=[evidence?.firstIncomingText,...(Array.isArray(evidence?.incomingTexts)?evidence.incomingTexts:[])].filter(Boolean);
  const joined=texts.join("\n");
  if(!joined.trim()) return {nivel:"normal",confianca:0,evidencias:[],fonte:"vazio"};
  const scores={critica:0,alta:0,normal:0,baixa:0};
  const allEvidence={critica:[],alta:[],normal:[],baixa:[]};
  // Sinais genéricos
  for(const[level,signals]of Object.entries(GENERIC_URGENCY)){
    const hits=matchSignals(joined,signals);
    if(hits.length){scores[level]+=hits.length*1.0;allEvidence[level].push(...hits);}
  }
  // Sinais do nicho (peso maior)
  if(nicheModel&&Array.isArray(nicheModel.urgencySignals)){
    const hits=matchSignals(joined,nicheModel.urgencySignals);
    if(hits.length){scores.alta+=hits.length*2.0;scores.critica+=hits.length*0.5;allEvidence.alta.push(...hits.map(h=>`(nicho) ${h}`));}
  }
  // Determina nível vencedor
  let bestLevel="normal";let bestScore=scores.normal;
  for(const level of URGENCY_LEVELS){if(scores[level]>bestScore){bestScore=scores[level];bestLevel=level;}}
  if(bestScore===0) return {nivel:"normal",confianca:0,evidencias:[],fonte:"nenhum_sinal"};
  const conf=Math.min(0.98,0.3+(bestScore*0.12));
  const evids=allEvidence[bestLevel].slice(0,5);
  const fonte=nicheModel&&evids.some(e=>String(e).startsWith("(nicho)"))?`modelo_${nicheModel.id}`:"generico";
  return {nivel:bestLevel,confianca:Number(conf.toFixed(2)),evidencias:evids,fonte};
}