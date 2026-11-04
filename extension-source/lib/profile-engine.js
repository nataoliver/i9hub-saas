/**
 * i9Leads Flow — Smart Business Profile Engine (Tarefa 4)
 * Motor puro para montar o perfil do negócio sem depender de DOM/Chrome.
 *
 * O perfil adapta nomenclatura, campos, módulos sugeridos, funil e sinais
 * comerciais. Ele não altera dados existentes do CRM sem uma ação explícita do usuário.
 */

export const BUSINESS_PROFILE_VERSION = "1.0.0";

export const MODULE_META = Object.freeze({
  crm: { label: "CRM e oportunidades", icon: "fa-address-book" },
  whatsapp: { label: "WhatsApp", icon: "fa-whatsapp" },
  campaigns: { label: "Campanhas", icon: "fa-bullhorn" },
  followup: { label: "Follow-up e tarefas", icon: "fa-list-check" },
  agenda: { label: "Agenda e atendimentos", icon: "fa-calendar-days" },
  finance: { label: "Financeiro", icon: "fa-wallet" },
  recurring: { label: "Recorrências e assinaturas", icon: "fa-rotate" },
  contracts: { label: "Contratos", icon: "fa-file-contract" },
  documents: { label: "Documentos", icon: "fa-folder-open" },
  products: { label: "Produtos e serviços", icon: "fa-box" },
  services: { label: "Serviços", icon: "fa-concierge-bell" },
  inventory: { label: "Estoque", icon: "fa-boxes-stacked" },
  proposals: { label: "Orçamentos e propostas", icon: "fa-file-invoice-dollar" },
  cases: { label: "Casos e processos", icon: "fa-scale-balanced" },
  treatments: { label: "Planos de tratamento", icon: "fa-tooth" },
  retention: { label: "Recompra e retenção", icon: "fa-heart" },
  reports: { label: "Indicadores", icon: "fa-chart-line" },
});

const colors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#22c55e", "#ec4899", "#14b8a6", "#f97316"];

const field = (key, label, type = "text", extra = {}) => ({ key, label, type, ...extra });

const COMMON_FIELDS = [
  field("responsavel", "Responsável"),
  field("observacoes_operacionais", "Observações operacionais", "textarea"),
];

const PROFILES = {
  generic: {
    id: "generic",
    name: "Negócio de serviços",
    icon: "fa-briefcase",
    description: "Perfil flexível para prestadores de serviços e negócios que não se encaixam em um segmento específico.",
    modules: ["crm", "whatsapp", "campaigns", "followup", "proposals", "finance", "reports"],
    terminology: { contact: "Contato", contactPlural: "Contatos", opportunity: "Oportunidade", opportunityPlural: "Oportunidades", service: "Serviço", product: "Produto", case: "Caso" },
    fields: [...COMMON_FIELDS, field("empresa", "Empresa"), field("servico_interesse", "Serviço de interesse")],
    pipeline: [
      { id: "novo", title: "Novo", color: colors[0] },
      { id: "contatado", title: "Contatado", color: colors[3] },
      { id: "qualificado", title: "Qualificado", color: colors[1] },
      { id: "proposta", title: "Proposta", color: colors[2] },
      { id: "fechado", title: "Fechado", color: colors[4] },
      { id: "perdido", title: "Perdido", color: "#ef4444" },
    ],
    prospectKeywords: ["preço", "valor", "orçamento", "serviço", "contratar", "quanto custa", "prazo"],
    automations: ["Criar follow-up após novo contato", "Lembrar proposta sem resposta"],
  },
  accounting: {
    id: "accounting",
    name: "Contabilidade",
    icon: "fa-calculator",
    description: "Escritórios contábeis, contadores e consultorias fiscais.",
    modules: ["crm", "whatsapp", "campaigns", "followup", "finance", "recurring", "contracts", "documents", "proposals", "reports"],
    terminology: { contact: "Empresa", contactPlural: "Empresas", opportunity: "Oportunidade", opportunityPlural: "Oportunidades", service: "Serviço contábil", product: "Serviço", case: "Atendimento" },
    fields: [
      ...COMMON_FIELDS, field("cnpj", "CNPJ"), field("regime_tributario", "Regime tributário"),
      field("honorario_mensal", "Honorário mensal", "currency"), field("dia_vencimento", "Dia de vencimento", "number"),
      field("responsavel_contabil", "Responsável contábil"), field("documentos_pendentes", "Documentos pendentes", "textarea"),
    ],
    pipeline: [
      { id: "novo", title: "Novo contato", color: colors[0] },
      { id: "contatado", title: "Contato realizado", color: colors[3] },
      { id: "qualificado", title: "Diagnóstico", color: colors[1] },
      { id: "proposta", title: "Proposta", color: colors[2] },
      { id: "fechado", title: "Contrato fechado", color: colors[4] },
      { id: "bp_onboarding", title: "Onboarding", color: colors[5] },
      { id: "bp_ativo", title: "Cliente ativo", color: colors[6] },
    ],
    prospectKeywords: ["contabilidade", "contador", "mensalidade", "honorário", "honorario", "imposto", "folha", "cnpj", "abertura de empresa", "declaração", "declaracao"],
    automations: ["Lembrar documentos pendentes", "Cobrança de honorário recorrente", "Avisar renovação de contrato"],
  },
  dental: {
    id: "dental",
    name: "Clínica / Odontologia",
    icon: "fa-tooth",
    description: "Consultórios, clínicas odontológicas e profissionais da área.",
    modules: ["crm", "whatsapp", "campaigns", "followup", "agenda", "finance", "proposals", "treatments", "documents", "retention", "reports"],
    terminology: { contact: "Paciente", contactPlural: "Pacientes", opportunity: "Novo paciente", opportunityPlural: "Novos pacientes", service: "Procedimento", product: "Produto", case: "Tratamento" },
    fields: [
      ...COMMON_FIELDS, field("data_nascimento", "Data de nascimento", "date"), field("convenio", "Convênio"),
      field("procedimento_interesse", "Procedimento de interesse"), field("ultima_consulta", "Última consulta", "date"),
      field("proximo_retorno", "Próximo retorno", "date"), field("plano_tratamento", "Plano de tratamento", "textarea"),
      field("valor_tratamento", "Valor do tratamento", "currency"),
    ],
    pipeline: [
      { id: "novo", title: "Novo paciente", color: colors[0] },
      { id: "contatado", title: "Contato realizado", color: colors[3] },
      { id: "qualificado", title: "Avaliação agendada", color: colors[1] },
      { id: "bp_avaliacao", title: "Avaliação realizada", color: colors[2] },
      { id: "proposta", title: "Orçamento", color: colors[5] },
      { id: "fechado", title: "Tratamento aprovado", color: colors[4] },
      { id: "bp_tratamento", title: "Em tratamento", color: colors[6] },
      { id: "bp_retorno", title: "Retorno", color: colors[7] },
    ],
    prospectKeywords: ["consulta", "avaliação", "avaliacao", "dentista", "dente", "limpeza", "clareamento", "implante", "aparelho", "restauração", "restauracao", "tratamento", "orçamento", "orcamento"],
    automations: ["Confirmar consulta", "Lembrar retorno", "Reativar paciente sem retorno"],
  },
  legal: {
    id: "legal",
    name: "Advocacia",
    icon: "fa-scale-balanced",
    description: "Escritórios de advocacia e profissionais jurídicos.",
    modules: ["crm", "whatsapp", "campaigns", "followup", "finance", "contracts", "documents", "proposals", "cases", "agenda", "reports"],
    terminology: { contact: "Cliente", contactPlural: "Clientes", opportunity: "Caso", opportunityPlural: "Casos", service: "Serviço jurídico", product: "Serviço", case: "Processo" },
    fields: [
      ...COMMON_FIELDS, field("cpf_cnpj", "CPF/CNPJ"), field("area_juridica", "Área jurídica"),
      field("numero_processo", "Número do processo"), field("tribunal", "Tribunal"), field("comarca", "Comarca"),
      field("parte_contraria", "Parte contrária"), field("proximo_prazo", "Próximo prazo", "date"),
      field("valor_honorarios", "Honorários", "currency"),
    ],
    pipeline: [
      { id: "novo", title: "Novo cliente", color: colors[0] },
      { id: "contatado", title: "Triagem", color: colors[3] },
      { id: "qualificado", title: "Análise do caso", color: colors[1] },
      { id: "proposta", title: "Honorários / proposta", color: colors[2] },
      { id: "fechado", title: "Contrato fechado", color: colors[4] },
      { id: "bp_processo", title: "Processo em andamento", color: colors[5] },
      { id: "bp_prazo", title: "Prazo / audiência", color: colors[6] },
    ],
    prospectKeywords: ["advogado", "advocacia", "processo", "ação", "acao", "causa", "audiência", "audiencia", "honorários", "honorarios", "contrato", "jurídico", "juridico"],
    automations: ["Criar lembrete para prazo", "Acompanhar proposta de honorários", "Avisar vencimento contratual"],
  },
  retail: {
    id: "retail",
    name: "Loja de roupas",
    icon: "fa-shirt",
    description: "Varejo de moda, lojas físicas, vendas por WhatsApp, Instagram e e-commerce.",
    modules: ["crm", "whatsapp", "campaigns", "followup", "products", "inventory", "finance", "proposals", "retention", "reports"],
    terminology: { contact: "Cliente", contactPlural: "Clientes", opportunity: "Venda", opportunityPlural: "Vendas", service: "Atendimento", product: "Produto", case: "Pedido" },
    fields: [
      ...COMMON_FIELDS, field("tamanho_preferido", "Tamanho preferido"), field("cor_preferida", "Cor preferida"),
      field("produto_favorito", "Produto favorito"), field("ultima_compra", "Última compra", "date"),
      field("ticket_medio", "Ticket médio", "currency"), field("vendedor", "Vendedor"),
    ],
    pipeline: [
      { id: "novo", title: "Novo cliente", color: colors[0] },
      { id: "contatado", title: "Atendimento", color: colors[3] },
      { id: "qualificado", title: "Interesse identificado", color: colors[1] },
      { id: "proposta", title: "Carrinho / proposta", color: colors[2] },
      { id: "fechado", title: "Venda concluída", color: colors[4] },
      { id: "bp_posvenda", title: "Pós-venda", color: colors[6] },
    ],
    prospectKeywords: ["camisa", "calça", "calca", "vestido", "blusa", "short", "bermuda", "tamanho", "cor", "preço", "preco", "valor", "frete", "entrega", "comprar", "catálogo", "catalogo"],
    automations: ["Reativar cliente após período sem compra", "Enviar novidades por perfil", "Lembrar carrinho sem fechamento"],
  },
  salon: {
    id: "salon",
    name: "Salão / Barbearia",
    icon: "fa-scissors",
    description: "Salões de beleza, barbearias, estética e serviços de imagem.",
    modules: ["crm", "whatsapp", "campaigns", "followup", "agenda", "finance", "services", "retention", "reports"],
    terminology: { contact: "Cliente", contactPlural: "Clientes", opportunity: "Agendamento", opportunityPlural: "Agendamentos", service: "Serviço", product: "Produto", case: "Atendimento" },
    fields: [
      ...COMMON_FIELDS, field("servico_favorito", "Serviço favorito"), field("profissional_preferido", "Profissional preferido"),
      field("ultimo_atendimento", "Último atendimento", "date"), field("proximo_retorno", "Próximo retorno", "date"),
    ],
    pipeline: [
      { id: "novo", title: "Novo cliente", color: colors[0] },
      { id: "contatado", title: "Contato", color: colors[3] },
      { id: "qualificado", title: "Agendamento", color: colors[1] },
      { id: "fechado", title: "Atendimento realizado", color: colors[4] },
      { id: "bp_retorno", title: "Retorno", color: colors[6] },
    ],
    prospectKeywords: ["corte", "cabelo", "barba", "manicure", "pedicure", "escova", "coloração", "coloracao", "horário", "horario", "agendar", "salão", "salao"],
    automations: ["Confirmar agendamento", "Lembrar retorno", "Reativar cliente sem visita"],
  },
  fitness: {
    id: "fitness",
    name: "Academia / Personal",
    icon: "fa-dumbbell",
    description: "Academias, personal trainers e serviços de treinamento.",
    modules: ["crm", "whatsapp", "campaigns", "followup", "agenda", "finance", "recurring", "retention", "reports"],
    terminology: { contact: "Aluno", contactPlural: "Alunos", opportunity: "Matrícula", opportunityPlural: "Matrículas", service: "Plano", product: "Produto", case: "Atendimento" },
    fields: [...COMMON_FIELDS, field("plano_interesse", "Plano de interesse"), field("objetivo", "Objetivo"), field("data_inicio", "Data de início", "date"), field("ultima_presenca", "Última presença", "date")],
    pipeline: [
      { id: "novo", title: "Novo interessado", color: colors[0] },
      { id: "contatado", title: "Contato", color: colors[3] },
      { id: "qualificado", title: "Aula / visita", color: colors[1] },
      { id: "proposta", title: "Plano apresentado", color: colors[2] },
      { id: "fechado", title: "Matrícula", color: colors[4] },
      { id: "bp_ativo", title: "Aluno ativo", color: colors[6] },
    ],
    prospectKeywords: ["academia", "personal", "treino", "treinamento", "plano", "mensalidade", "aula", "musculação", "musculacao"],
    automations: ["Lembrar renovação", "Reativar aluno inativo", "Cobrança recorrente"],
  },
  realestate: {
    id: "realestate",
    name: "Imobiliária",
    icon: "fa-house",
    description: "Imobiliárias, corretores e negócios de compra, venda e locação.",
    modules: ["crm", "whatsapp", "campaigns", "followup", "agenda", "finance", "proposals", "contracts", "documents", "retention", "reports"],
    terminology: { contact: "Cliente", contactPlural: "Clientes", opportunity: "Negociação", opportunityPlural: "Negociações", service: "Intermediação", product: "Imóvel", case: "Negociação" },
    fields: [...COMMON_FIELDS, field("tipo_imovel", "Tipo de imóvel"), field("finalidade", "Finalidade"), field("faixa_valor", "Faixa de valor", "currency"), field("regiao_interesse", "Região de interesse")],
    pipeline: [
      { id: "novo", title: "Novo interessado", color: colors[0] },
      { id: "contatado", title: "Contato", color: colors[3] },
      { id: "qualificado", title: "Perfil qualificado", color: colors[1] },
      { id: "proposta", title: "Proposta", color: colors[2] },
      { id: "fechado", title: "Negócio fechado", color: colors[4] },
      { id: "bp_visita", title: "Visita / documentação", color: colors[6] },
    ],
    prospectKeywords: ["imóvel", "imovel", "casa", "apartamento", "terreno", "aluguel", "locação", "locacao", "comprar", "vender", "visita", "financiamento"],
    automations: ["Lembrar visita", "Follow-up de proposta", "Reativar interessado"],
  },
  restaurant: {
    id: "restaurant",
    name: "Restaurante / Alimentação",
    icon: "fa-utensils",
    description: "Restaurantes, delivery, lanchonetes e negócios de alimentação.",
    modules: ["crm", "whatsapp", "campaigns", "followup", "products", "inventory", "finance", "retention", "reports"],
    terminology: { contact: "Cliente", contactPlural: "Clientes", opportunity: "Pedido", opportunityPlural: "Pedidos", service: "Atendimento", product: "Produto", case: "Pedido" },
    fields: [...COMMON_FIELDS, field("preferencia", "Preferência"), field("ultimo_pedido", "Último pedido", "date"), field("ticket_medio", "Ticket médio", "currency")],
    pipeline: [
      { id: "novo", title: "Novo cliente", color: colors[0] },
      { id: "contatado", title: "Atendimento", color: colors[3] },
      { id: "proposta", title: "Pedido", color: colors[2] },
      { id: "fechado", title: "Pedido concluído", color: colors[4] },
      { id: "bp_posvenda", title: "Pós-venda", color: colors[6] },
    ],
    prospectKeywords: ["pedido", "cardápio", "cardapio", "delivery", "entrega", "mesa", "reserva", "preço", "preco", "combo"],
    automations: ["Reativar cliente", "Enviar novidades", "Lembrar reserva"],
  },
  automotive: {
    id: "automotive",
    name: "Automotivo",
    icon: "fa-car",
    description: "Oficinas, estética automotiva, lojas e serviços para veículos.",
    modules: ["crm", "whatsapp", "campaigns", "followup", "agenda", "finance", "products", "inventory", "proposals", "retention", "reports"],
    terminology: { contact: "Cliente", contactPlural: "Clientes", opportunity: "Orçamento", opportunityPlural: "Orçamentos", service: "Serviço", product: "Peça", case: "Veículo" },
    fields: [...COMMON_FIELDS, field("veiculo", "Veículo"), field("placa", "Placa"), field("km", "Quilometragem", "number"), field("ultimo_servico", "Último serviço", "date"), field("proximo_servico", "Próximo serviço", "date")],
    pipeline: [
      { id: "novo", title: "Novo atendimento", color: colors[0] },
      { id: "contatado", title: "Diagnóstico", color: colors[3] },
      { id: "proposta", title: "Orçamento", color: colors[2] },
      { id: "fechado", title: "Serviço aprovado", color: colors[4] },
      { id: "bp_execucao", title: "Em execução", color: colors[5] },
      { id: "bp_retorno", title: "Próximo serviço", color: colors[6] },
    ],
    prospectKeywords: ["carro", "veículo", "veiculo", "oficina", "revisão", "revisao", "óleo", "oleo", "pneu", "funilaria", "orçamento", "orcamento"],
    automations: ["Lembrar próxima revisão", "Follow-up de orçamento", "Reativar cliente"],
  },
  ecommerce: {
    id: "ecommerce",
    name: "E-commerce",
    icon: "fa-cart-shopping",
    description: "Operações digitais com vendas online e relacionamento por canais digitais.",
    modules: ["crm", "whatsapp", "campaigns", "followup", "products", "inventory", "finance", "proposals", "retention", "reports"],
    terminology: { contact: "Cliente", contactPlural: "Clientes", opportunity: "Venda", opportunityPlural: "Vendas", service: "Atendimento", product: "Produto", case: "Pedido" },
    fields: [...COMMON_FIELDS, field("ultima_compra", "Última compra", "date"), field("ticket_medio", "Ticket médio", "currency"), field("produto_favorito", "Produto favorito"), field("canal_preferido", "Canal preferido")],
    pipeline: [
      { id: "novo", title: "Novo cliente", color: colors[0] },
      { id: "contatado", title: "Atendimento", color: colors[3] },
      { id: "qualificado", title: "Interesse", color: colors[1] },
      { id: "proposta", title: "Carrinho / proposta", color: colors[2] },
      { id: "fechado", title: "Venda concluída", color: colors[4] },
      { id: "bp_posvenda", title: "Pós-venda", color: colors[6] },
    ],
    prospectKeywords: ["comprar", "pedido", "produto", "frete", "entrega", "carrinho", "cupom", "preço", "preco", "valor"],
    automations: ["Recuperar carrinho", "Recompra", "Pós-venda"],
  },
  recurring: {
    id: "recurring",
    name: "Serviços recorrentes",
    icon: "fa-rotate",
    description: "Negócios baseados em mensalidades, contratos e assinaturas.",
    modules: ["crm", "whatsapp", "campaigns", "followup", "finance", "recurring", "contracts", "documents", "proposals", "retention", "reports"],
    terminology: { contact: "Cliente", contactPlural: "Clientes", opportunity: "Assinatura", opportunityPlural: "Assinaturas", service: "Serviço recorrente", product: "Plano", case: "Contrato" },
    fields: [...COMMON_FIELDS, field("plano", "Plano"), field("valor_recorrente", "Valor recorrente", "currency"), field("dia_cobranca", "Dia de cobrança", "number"), field("inicio_contrato", "Início do contrato", "date"), field("proxima_renovacao", "Próxima renovação", "date")],
    pipeline: [
      { id: "novo", title: "Novo cliente", color: colors[0] },
      { id: "contatado", title: "Diagnóstico", color: colors[3] },
      { id: "proposta", title: "Proposta", color: colors[2] },
      { id: "fechado", title: "Contrato ativo", color: colors[4] },
      { id: "bp_recorrente", title: "Recorrência ativa", color: colors[6] },
      { id: "bp_renovacao", title: "Renovação", color: colors[5] },
    ],
    prospectKeywords: ["mensalidade", "assinatura", "plano", "recorrente", "renovação", "renovacao", "contrato", "mensal", "anual"],
    automations: ["Avisar próxima cobrança", "Avisar renovação", "Reativar cancelamento"],
  },
  services: {
    id: "services",
    name: "Prestação de serviços",
    icon: "fa-screwdriver-wrench",
    description: "Prestadores de serviços técnicos, consultorias e atendimento sob demanda.",
    modules: ["crm", "whatsapp", "campaigns", "followup", "agenda", "finance", "proposals", "contracts", "documents", "retention", "reports"],
    terminology: { contact: "Cliente", contactPlural: "Clientes", opportunity: "Orçamento", opportunityPlural: "Orçamentos", service: "Serviço", product: "Material", case: "Atendimento" },
    fields: [...COMMON_FIELDS, field("servico_interesse", "Serviço de interesse"), field("local_atendimento", "Local de atendimento"), field("ultima_execucao", "Última execução", "date"), field("proxima_execucao", "Próxima execução", "date")],
    pipeline: [
      { id: "novo", title: "Novo atendimento", color: colors[0] },
      { id: "contatado", title: "Contato", color: colors[3] },
      { id: "qualificado", title: "Diagnóstico", color: colors[1] },
      { id: "proposta", title: "Orçamento", color: colors[2] },
      { id: "fechado", title: "Serviço aprovado", color: colors[4] },
      { id: "bp_execucao", title: "Execução", color: colors[5] },
      { id: "bp_posvenda", title: "Pós-venda", color: colors[6] },
    ],
    prospectKeywords: ["orçamento", "orcamento", "serviço", "servico", "visita", "instalação", "instalacao", "manutenção", "manutencao", "prazo"],
    automations: ["Follow-up de orçamento", "Lembrar manutenção", "Pós-venda"],
  },
};

export const BUSINESS_PROFILES = Object.freeze(PROFILES);

export const BUSINESS_TYPES = Object.freeze(
  Object.values(PROFILES).map(({ id, name, icon, description }) => ({ id, name, icon, description }))
);

export const PROFILE_QUESTIONNAIRE = Object.freeze([
  {
    id: "revenueModel",
    title: "Como seu negócio ganha dinheiro?",
    type: "multi",
    options: [
      { value: "one_time", label: "Venda ou serviço pontual", modules: [] },
      { value: "recurring", label: "Mensalidade / assinatura", modules: ["finance", "recurring", "contracts", "retention"] },
      { value: "contract", label: "Contrato", modules: ["contracts", "documents"] },
      { value: "product", label: "Venda de produtos", modules: ["products", "inventory"] },
      { value: "service", label: "Prestação de serviços", modules: ["proposals", "followup"] },
    ],
  },
  {
    id: "channels",
    title: "Onde você atende ou vende?",
    type: "multi",
    options: [
      { value: "whatsapp", label: "WhatsApp", modules: ["whatsapp"] },
      { value: "instagram", label: "Instagram / redes sociais", modules: ["campaigns"] },
      { value: "physical", label: "Loja / atendimento presencial", modules: ["agenda"] },
      { value: "website", label: "Site / e-commerce", modules: ["products"] },
    ],
  },
  {
    id: "operations",
    title: "O que você precisa controlar?",
    type: "multi",
    options: [
      { value: "agenda", label: "Agendamentos e retornos", modules: ["agenda"] },
      { value: "finance", label: "Contas a receber", modules: ["finance"] },
      { value: "documents", label: "Documentos", modules: ["documents"] },
      { value: "contracts", label: "Contratos", modules: ["contracts"] },
      { value: "products", label: "Produtos / serviços", modules: ["products"] },
      { value: "inventory", label: "Estoque", modules: ["inventory"] },
      { value: "cases", label: "Casos / processos", modules: ["cases"] },
      { value: "treatments", label: "Planos de tratamento", modules: ["treatments"] },
    ],
  },
  {
    id: "scale",
    title: "Como é sua operação?",
    type: "single",
    options: [
      { value: "solo", label: "Eu / uma pessoa" },
      { value: "small", label: "2 a 5 pessoas" },
      { value: "medium", label: "6 a 20 pessoas" },
      { value: "large", label: "Mais de 20 pessoas" },
    ],
  },
]);

export const DEFAULT_PROFILE_ANSWERS = Object.freeze({
  revenueModel: ["service"],
  channels: ["whatsapp"],
  operations: [],
  scale: "solo",
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeProfileId(value) {
  const id = String(value || "").trim();
  return PROFILES[id] ? id : "generic";
}

export function getBusinessProfile(id) {
  return clone(PROFILES[normalizeProfileId(id)]);
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 42) || "negocio";
}

export function detectProfileFromDescription(description) {
  const text = String(description || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const scores = Object.values(PROFILES).map((p) => {
    const hits = p.prospectKeywords.filter((kw) => text.includes(String(kw).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()));
    return { id: p.id, score: hits.length, hits };
  }).sort((a, b) => b.score - a.score);
  const best = scores[0];
  return best && best.score > 0 ? { profileId: best.id, score: best.score, hits: best.hits } : { profileId: "generic", score: 0, hits: [] };
}

function mergeFields(...lists) {
  const map = new Map();
  for (const list of lists.flat()) {
    if (!list?.key) continue;
    if (!map.has(list.key)) map.set(list.key, { ...list });
  }
  return [...map.values()];
}

function customPipeline(base, modules) {
  const existing = new Set(base.pipeline.map((x) => x.id));
  const additions = [];
  const add = (id, title, colorIndex) => {
    if (!existing.has(id) && !additions.some((x) => x.id === id)) additions.push({ id, title, color: colors[colorIndex % colors.length] });
  };
  if (modules.includes("agenda")) add("bp_agendamento", "Agendamento", 1);
  if (modules.includes("finance")) add("bp_financeiro", "Financeiro", 3);
  if (modules.includes("recurring")) add("bp_recorrente", "Recorrência ativa", 6);
  if (modules.includes("contracts")) add("bp_contrato", "Contrato", 2);
  if (modules.includes("documents")) add("bp_documentos", "Documentação", 5);
  if (modules.includes("inventory")) add("bp_estoque", "Estoque / preparação", 7);
  if (modules.includes("cases")) add("bp_processo", "Processo em andamento", 5);
  if (modules.includes("treatments")) add("bp_tratamento", "Em tratamento", 6);
  if (modules.includes("retention")) add("bp_posvenda", "Pós-venda", 7);
  return [...base.pipeline, ...additions];
}

export function buildBusinessProfile({
  businessType = "generic",
  answers = {},
  description = "",
  selectedModules = [],
  name = "",
} = {}) {
  const detected = businessType === "generic" && description ? detectProfileFromDescription(description) : null;
  const baseId = detected?.profileId || normalizeProfileId(businessType);
  const base = getBusinessProfile(baseId);
  const normalizedAnswers = {
    ...DEFAULT_PROFILE_ANSWERS,
    ...(answers || {}),
    revenueModel: Array.isArray(answers?.revenueModel) ? answers.revenueModel : DEFAULT_PROFILE_ANSWERS.revenueModel,
    channels: Array.isArray(answers?.channels) ? answers.channels : DEFAULT_PROFILE_ANSWERS.channels,
    operations: Array.isArray(answers?.operations) ? answers.operations : [],
  };

  const moduleSet = new Set(["crm", "whatsapp", "campaigns", "followup", ...base.modules]);
  const addFrom = (questionId) => {
    const q = PROFILE_QUESTIONNAIRE.find((x) => x.id === questionId);
    const values = normalizedAnswers[questionId];
    const selected = Array.isArray(values) ? values : [values];
    for (const opt of q?.options || []) if (selected.includes(opt.value)) (opt.modules || []).forEach((m) => moduleSet.add(m));
  };
  addFrom("revenueModel");
  addFrom("channels");
  addFrom("operations");
  for (const m of Array.isArray(selectedModules) ? selectedModules : []) moduleSet.add(String(m));

  const fieldsByModule = {
    finance: [field("valor_total", "Valor total", "currency"), field("status_pagamento", "Status do pagamento")],
    recurring: [field("valor_recorrente", "Valor recorrente", "currency"), field("proxima_cobranca", "Próxima cobrança", "date"), field("status_recorrencia", "Status da recorrência")],
    contracts: [field("numero_contrato", "Número do contrato"), field("inicio_contrato", "Início do contrato", "date"), field("fim_contrato", "Fim do contrato", "date")],
    products: [field("produto_interesse", "Produto de interesse"), field("sku", "SKU")],
    inventory: [field("sku", "SKU"), field("quantidade", "Quantidade", "number")],
    agenda: [field("proximo_agendamento", "Próximo agendamento", "date"), field("profissional", "Profissional")],
    cases: [field("numero_caso", "Número do caso"), field("proximo_prazo", "Próximo prazo", "date")],
    treatments: [field("plano_tratamento", "Plano de tratamento", "textarea"), field("proximo_retorno", "Próximo retorno", "date")],
    documents: [field("documentos_pendentes", "Documentos pendentes", "textarea")],
  };
  const extraFields = [...moduleSet].flatMap((m) => fieldsByModule[m] || []);
  const fields = mergeFields(base.fields, extraFields);

  const moduleKeywords = {
    finance: ["pagamento", "cobrança", "cobranca", "boleto", "parcelamento"],
    recurring: ["mensalidade", "assinatura", "recorrente", "renovação", "renovacao"],
    products: ["produto", "preço", "preco", "valor", "comprar", "catálogo", "catalogo"],
    agenda: ["agendar", "agenda", "horário", "horario", "marcar", "consulta"],
    contracts: ["contrato", "renovação", "renovacao"],
    cases: ["processo", "caso", "prazo", "audiência", "audiencia"],
    treatments: ["tratamento", "plano", "procedimento"],
  };
  const prospectKeywords = [...new Set([
    ...(base.prospectKeywords || []),
    ...[...moduleSet].flatMap((m) => moduleKeywords[m] || []),
  ])];

  const isCustom = !PROFILES[baseId] || businessType === "custom";
  const customName = String(name || "").trim();
  const finalName = customName || (businessType === "custom" ? "Meu negócio personalizado" : base.name);

  return {
    version: BUSINESS_PROFILE_VERSION,
    id: baseId,
    name: finalName,
    icon: base.icon || "fa-briefcase",
    description: String(description || base.description || "").trim(),
    businessType: baseId,
    selectedBusinessType: String(businessType || "generic"),
    custom: isCustom || baseId === "generic" && String(description || "").trim().length > 0,
    configured: true,
    source: detected && detected.score > 0 ? "questionnaire_auto_detect" : "questionnaire",
    answers: clone(normalizedAnswers),
    modules: [...moduleSet],
    fields,
    pipeline: customPipeline(base, [...moduleSet]),
    terminology: clone(base.terminology),
    prospectKeywords,
    automations: [...new Set(base.automations || [])],
    detectedFromDescription: detected && detected.score > 0 ? detected : null,
    updatedAt: new Date().toISOString(),
  };
}

export function profileSummary(profile) {
  if (!profile) return null;
  return {
    name: profile.name,
    businessType: profile.businessType,
    moduleCount: Array.isArray(profile.modules) ? profile.modules.length : 0,
    fieldCount: Array.isArray(profile.fields) ? profile.fields.length : 0,
    pipelineCount: Array.isArray(profile.pipeline) ? profile.pipeline.length : 0,
    configured: profile.configured === true,
  };
}
