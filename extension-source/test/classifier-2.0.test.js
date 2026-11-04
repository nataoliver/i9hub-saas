import test from "node:test";
import assert from "node:assert/strict";
import { classifyLead, CLASSIFIER_VERSION } from "../lib/classifier.js";

const baseEvidence = (text) => ({ firstIncomingText: text, incomingTexts: [text] });
const noReplyEvidence = (extra) => ({ userReplied: false, ...extra });

test("prospecto pedindo orcamento", () => {
  const r = classifyLead({}, baseEvidence("Quero um orcamento para abrir empresa"), { nicheId: "contabilidade" });
  assert.equal(r.tipo, "prospecto");
  assert.ok(r.score >= 55);
  assert.equal(r.intencao.nome, "pedir_orcamento");
  assert.ok(r.motivos.length > 0);
  assert.equal(r.versaoModelo, CLASSIFIER_VERSION);
});

test("cliente identificado por estagio fechado", () => {
  const r = classifyLead({ stage: "fechado" }, baseEvidence("ola"), {});
  assert.equal(r.tipo, "cliente");
  assert.ok(r.confianca >= 0.9);
});

test("mensagem repetida flood com keyword spam detectada como spam", () => {
  const r = classifyLead({}, noReplyEvidence({ recentMessageCount: 10, firstIncomingText: "aposta cassino ganhe dinheiro", incomingTexts: ["aposta cassino ganhe dinheiro"] }), {});
  assert.equal(r.tipo, "spam");
  assert.ok(r.spamLevel === "confirmado" || r.spamLevel === "provavel");
});

test("link suspeito em primeira mensagem gera sinal de atencao ou motivo", () => {
  const r = classifyLead({}, noReplyEvidence({ isFirstMessage: true, firstIncomingText: "veja https://bit.ly/abc123 oferta", incomingTexts: ["veja https://bit.ly/abc123 oferta"] }), {});
  const hasLinkSignal = r.motivos.some(m => m.texto.includes("link encurtado")) || r.sinaisAtencao.some(s => s.includes("spam"));
  assert.ok(hasLinkSignal, "Deve detectar link encurtado como sinal negativo ou de atencao");
});

test("spam confirmado com keyword forte", () => {
  const r = classifyLead({}, noReplyEvidence({ firstIncomingText: "ganhe dinheiro facil com criptomoeda", incomingTexts: ["ganhe dinheiro facil com criptomoeda"] }), {});
  assert.equal(r.tipo, "spam");
  assert.equal(r.spamLevel, "confirmado");
  assert.ok(r.sinaisAtencao.some(s => s.includes("arquivamento")));
});

test("spam provavel nao e tratado como confirmado", () => {
  const r = classifyLead({}, noReplyEvidence({ isFirstMessage: true, firstIncomingText: "veja bit.ly/oferta1 e bit.ly/oferta2", incomingTexts: ["veja bit.ly/oferta1 e bit.ly/oferta2"] }), {});
  if (r.tipo === "spam") {
    assert.notEqual(r.spamLevel, "confirmado");
  }
});

test("mensagem ambigua permanece em a_classificar", () => {
  const r = classifyLead({}, baseEvidence("oi tudo bem"), {});
  assert.equal(r.tipo, "a_classificar");
});

test("intencao de suporte", () => {
  const r = classifyLead({}, baseEvidence("meu produto chegou com erro e nao funciona"), {});
  assert.equal(r.intencao.nome, "suporte");
});

test("urgencia alta", () => {
  const r = classifyLead({}, baseEvidence("preciso resolver urgente hoje"), {});
  assert.ok(["alta","critica"].includes(r.urgencia.nivel));
});

test("urgencia critica", () => {
  const r = classifyLead({}, baseEvidence("emergencia preciso resolver agora hospital"), {});
  assert.equal(r.urgencia.nivel, "critica");
});

test("correcao de spam para prospecto via feedback ajusta confianca", () => {
  // O feedback so aplica quando adj.from === tipo classificado.
  // Como spam confirmado gera tipo="spam", usamos texto com keyword forte para garantir tipo=spam
  const history = [
    { previousDecision: "spam", newDecision: "prospecto" },
    { previousDecision: "spam", newDecision: "prospecto" },
    { previousDecision: "spam", newDecision: "prospecto" },
  ];
  const r = classifyLead({}, noReplyEvidence({ firstIncomingText: "ganhe dinheiro facil criptomoeda aposta", incomingTexts: ["ganhe dinheiro facil criptomoeda aposta"] }), { feedbackHistory: history });
  // Com 3 keywords, spamResult.score >= 85 -> tipo=spam -> feedback deve aplicar
  assert.ok(r.ajustadoPorFeedback === true || r.sinaisAtencao.some(s => s.includes("correcoes locais")), "Feedback deve ser aplicado quando ha 3+ correcoes identicas e tipo=spam");
});

test("modelo contabilidade reconhece abertura de empresa", () => {
  const r = classifyLead({}, baseEvidence("quero abrir empresa mei"), { nicheId: "contabilidade" });
  assert.equal(r.modeloNicho, "contabilidade");
  assert.ok(r.motivos.some(m => m.texto.includes("nicho")));
});

test("modelo dentista reconhece dor intensa como urgencia", () => {
  const r = classifyLead({}, baseEvidence("estou com dor intensa no dente"), { nicheId: "dentistas" });
  assert.equal(r.modeloNicho, "dentistas");
  assert.ok(["alta","critica"].includes(r.urgencia.nivel));
});

test("modelo imobiliaria reconhece visita", () => {
  const r = classifyLead({}, baseEvidence("quero agendar visita ao apartamento"), { nicheId: "imobiliaria" });
  assert.equal(r.modeloNicho, "imobiliaria");
  assert.equal(r.intencao.nome, "agendar");
});

test("ausencia de dados retorna a_classificar", () => {
  const r = classifyLead({}, {}, {});
  assert.equal(r.tipo, "a_classificar");
  assert.equal(r.intencao.nome, "sem_intencao_identificada");
});

test("conflito sinais positivos e negativos produz score valido", () => {
  const r = classifyLead({}, noReplyEvidence({ firstIncomingText: "quero comprar mas ganhe dinheiro facil", incomingTexts: ["quero comprar mas ganhe dinheiro facil"] }), {});
  assert.ok(r.score >= 0 && r.score <= 100, "Score deve estar entre 0 e 100 mesmo com sinais conflitantes");
  assert.ok(r.tipo !== undefined && r.tipo !== null, "Tipo deve ser definido");
});

test("preservacao do estagio do funil", () => {
  const r = classifyLead({ stage: "qualificado" }, baseEvidence("orcamento"), {});
  assert.notEqual(r.tipo, "cliente");
});

test("nenhum lead excluido automaticamente", () => {
  const r = classifyLead({}, noReplyEvidence({ firstIncomingText: "spam cassino aposta bitcoin", incomingTexts: ["spam cassino aposta bitcoin"] }), {});
  assert.ok(r.tipo !== undefined);
  assert.ok(r.tipo !== null);
});
