import { Privacy } from "../utils/privacy.js";
import { creditHTML } from "../utils/brand.js";
import { DEFAULT_CLASSIFIER_SETTINGS, normalizeClassifierSettings } from "../../lib/classifier.js";
export class SettingsView {
  constructor(app) {
    this.app = app;
    this.settings = {};
  }
  async render(container) {
    container.innerHTML = this.getHTML();
    await this.loadSettings();
    this.bindEvents();
  }
  getHTML() {
    return `<div class="settings-view">
 <header class="view-header"><h2><i class="fas fa-cog"></i> Configuracoes</h2></header>
 <div class="settings-tabs">
 <button class="tab-btn active" data-tab="license">Licenca</button>
 <button class="tab-btn" data-tab="webhook">Webhook</button>
 <button class="tab-btn" data-tab="delays">Delays</button>
 <button class="tab-btn" data-tab="spintax">Spintax</button>
 <button class="tab-btn" data-tab="classifier">Classificador</button>
 <button class="tab-btn" data-tab="appearance">Aparencia</button>
 <button class="tab-btn" data-tab="data">Dados</button><button class="tab-btn" data-tab="calendar" data-feature="google.calendar.connect">Google Agenda</button><button class="btn btn-primary" id="go-business-profile"><i class="fas fa-sliders"></i> Meu negócio</button><button class="btn btn-secondary" id="diagnostic-btn">Diagnóstico</button>
 </div>
 <div id="tab-license" class="tab-panel active">
 <div class="card">
 <div class="card-title"><i class="fas fa-key"></i> Chave de Licenca</div>
 <div class="form-group"><label class="form-label">Chave</label><input type="text" class="form-input" id="license-key" placeholder="Digite sua chave de licenca"></div>
 <div class="btn-group"><button class="btn btn-primary" id="validate-license"><i class="fas fa-check"></i> Validar</button><button class="btn btn-secondary" id="settings-upgrade-btn"><i class="fas fa-comment-dots"></i> Quero minha conta grátis</button></div>
 <div id="settings-license-status" class="license-status"></div>
 </div>
 </div>
 <div id="tab-webhook" class="tab-panel">
 <div class="card" data-feature="settings.webhook">
 <div class="card-title"><i class="fas fa-plug"></i> Configuracao de Webhook</div>
 <div class="form-group"><label class="form-label">URL do Webhook</label><input type="url" class="form-input" id="webhook-url" placeholder="https://seu-crm.com/webhook"></div>
 <div class="form-row"><div class="form-group"><label class="form-label">Metodo</label><select class="form-select" id="webhook-method"><option value="POST">POST</option><option value="PUT">PUT</option></select></div> <div class="form-group"><label class="form-label">Content-Type</label><select class="form-select" id="webhook-content-type"><option value="application/json">application/json</option><option value="application/x-www-form-urlencoded">form-urlencoded</option></select></div></div>
 <div class="form-group"><label class="form-label">Headers (JSON)</label><textarea class="form-textarea" id="webhook-headers" rows="3" placeholder='{"Authorization": "Bearer token", "X-Custom": "value"}'></textarea></div>
 <div class="form-group"><label class="form-label">API Key (opcional)</label><input type="text" class="form-input" id="webhook-api-key" placeholder="Chave da API"></div>
 <div class="btn-group"><button class="btn btn-primary" id="save-webhook"><i class="fas fa-save"></i> Salvar</button><button class="btn btn-secondary" id="test-webhook"><i class="fas fa-flask"></i> Testar Conexao</button></div>
 <div id="webhook-test-result"></div>
 </div>
 </div>
 <div id="tab-delays" class="tab-panel">
 <div class="card" data-feature="settings.delays">
 <div class="card-title"><i class="fas fa-clock"></i> Delays Padrao (ms)</div>
 <div class="form-row"><div class="form-group"><label class="form-label">Entre mensagens (min)</label><input type="number" class="form-input" id="delay-msg-min" value="2000"></div> <div class="form-group"><label class="form-label">Entre mensagens (max)</label><input type="number" class="form-input" id="delay-msg-max" value="5000"></div></div>
 <div class="form-row"><div class="form-group"><label class="form-label">Entre contatos (min)</label><input type="number" class="form-input" id="delay-contact-min" value="5000"></div> <div class="form-group"><label class="form-label">Entre contatos (max)</label><input type="number" class="form-input" id="delay-contact-max" value="15000"></div></div>
 <div class="form-row"><div class="form-group"><label class="form-label">Apos erro (min)</label><input type="number" class="form-input" id="delay-error-min" value="30000"></div> <div class="form-group"><label class="form-label">Apos erro (max)</label><input type="number" class="form-input" id="delay-error-max" value="60000"></div></div>
 <div class="btn-group"><button class="btn btn-primary" id="save-delays"><i class="fas fa-save"></i> Salvar Delays</button></div>
 </div>
 </div>
 <div id="tab-spintax" class="tab-panel">
 <div class="card" data-feature="settings.spintax">
 <div class="card-title"><i class="fas fa-dice"></i> Presets Spintax</div>
 <div id="spintax-presets"></div>
 <div class="btn-group" style="margin-top: 16px;"><button class="btn btn-primary" id="add-preset"><i class="fas fa-plus"></i> Adicionar Preset</button></div>
 </div>
 </div>
 <div id="tab-classifier" class="tab-panel">
 <div class="card" data-feature="settings.classifier">
 <div class="card-title"><i class="fas fa-filter"></i> Classificação automática de contatos</div>
 <p style="font-size:12px;opacity:.8;margin:0 0 12px">O tipo é separado do estágio do funil. A decisão manual sempre vence a automática. O classificador nunca coloca ninguém na Black List sozinho.</p>
 <div class="form-group"><label class="form-label">Palavras-chave de spam</label><textarea class="form-textarea" id="spam-keywords" rows="7" placeholder="Uma palavra ou expressão por linha"></textarea><small class="text-muted">Use expressões específicas para reduzir falsos positivos. Alterações nas palavras-chave valem para novas sincronizações.</small></div>
 <div class="form-row">
   <div class="form-group"><label class="form-label">Flood: mensagens mínimas</label><input type="number" min="2" max="100" class="form-input" id="spam-flood-count"></div>
   <div class="form-group"><label class="form-label">Janela do flood (segundos)</label><input type="number" min="10" max="3600" class="form-input" id="spam-flood-window"></div>
 </div>
 <div class="form-row">
   <div class="form-group"><label class="form-label">Mesma mensagem em números</label><input type="number" min="2" max="100" class="form-input" id="spam-same-message"></div>
   <div class="form-group"><label class="form-label">Interação recente (dias)</label><input type="number" min="1" max="365" class="form-input" id="spam-recent-days"></div>
 </div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="spam-shortened-link"><span class="toggle-slider"></span> Considerar link encurtado na primeira mensagem como spam</label></div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="spam-promo-first"><span class="toggle-slider"></span> Considerar mensagem promocional inicial como spam</label></div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="spam-outside-contact"><span class="toggle-slider"></span> Considerar número fora dos contatos, sem resposta do usuário, como spam</label></div>
 <div class="btn-group" style="flex-wrap:wrap"><button class="btn btn-primary" id="save-classifier"><i class="fas fa-save"></i> Salvar regras</button><button class="btn btn-secondary" id="reclassify-leads"><i class="fas fa-sync"></i> Reclassificar agora</button><button class="btn btn-ghost" id="reset-classifier"><i class="fas fa-undo"></i> Restaurar padrão</button></div>
 <p style="font-size:11px;opacity:.7;margin:10px 0 0">Prioridade automática: Cliente → Spam → Prospecto → A classificar. Se você já respondeu ao contato, ele nunca será marcado como spam automaticamente.</p>
 </div>
 </div>
<div id="tab-appearance" class="tab-panel">
 <div class="card" data-feature="settings.appearance">
 <div class="card-title"><i class="fas fa-palette"></i> Tema</div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="dark-theme" data-feature="settings.appearance"><span class="toggle-slider"></span> Tema Escuro</label></div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="compact-mode" data-feature="settings.appearance"><span class="toggle-slider"></span> Modo Compacto</label></div>
 </div>
 <div class="card" data-feature="settings.privacy">
 <div class="card-title"><i class="fas fa-eye-slash"></i> Modo privacidade (blur)</div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="priv-on" data-feature="settings.privacy"><span class="toggle-slider"></span> Ligar o modo privacidade</label></div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="priv-names" data-feature="settings.privacy"><span class="toggle-slider"></span> WhatsApp Web: desfocar nomes, grupos e prévias da lista</label></div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="priv-messages" data-feature="settings.privacy"><span class="toggle-slider"></span> WhatsApp Web: desfocar as mensagens da conversa aberta</label></div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="priv-photos" data-feature="settings.privacy"><span class="toggle-slider"></span> WhatsApp Web: desfocar fotos de perfil e mídias</label></div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="priv-panel" data-feature="settings.privacy"><span class="toggle-slider"></span> Painel da extensão: desfocar nomes, telefones e e-mails (CRM, Chats, Maps)</label></div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="priv-hover" data-feature="settings.privacy"><span class="toggle-slider"></span> Revelar ao passar o mouse</label></div>
 <p style="font-size:12px;opacity:.75;margin:0">Atalho: <strong>Alt+Shift+P</strong> liga e desliga, no WhatsApp Web e neste painel (também há um botão 👁️ no WhatsApp Web e no menu lateral). Muda só a aparência: não altera mensagens nem o envio das campanhas. O WhatsApp muda o visual de vez em quando; se algo deixar de ficar desfocado depois de uma atualização dele, avise para ajustarmos.</p>
 </div>
 <div class="card" id="telemetry-preferences-card" data-view-only>
 <div class="card-title"><i class="fas fa-shield-heart"></i> Privacidade e melhoria do i9Hub</div>
 <p style="font-size:12px;opacity:.8;margin:0 0 12px">Opcional. Se você permitir, enviaremos métricas operacionais para melhorar o produto, como módulos utilizados, erros e contagens agregadas. Não enviamos o texto das conversas, nomes de contatos ou números de telefone para a telemetria de produto.</p>
 <div class="form-group"><label class="form-label" for="user-telemetry-industry">Seu segmento (opcional)</label><select class="form-select" id="user-telemetry-industry"><option value="">Prefiro não informar</option><option value="accounting">Contabilidade</option><option value="law">Advocacia</option><option value="real_estate">Imobiliário</option><option value="marketing">Marketing / Agência</option><option value="sales">Vendas / Comercial</option><option value="retail">Comércio</option><option value="services">Prestação de serviços</option><option value="health">Saúde</option><option value="education">Educação</option><option value="other">Outro</option></select></div>
 <div class="form-row"><div class="form-group"><label class="form-label" for="user-telemetry-role">Sua função</label><select class="form-select" id="user-telemetry-role"><option value="">Não informado</option><option value="owner">Dono / Sócio</option><option value="manager">Gestor</option><option value="salesperson">Vendedor</option><option value="operator">Operação / Atendimento</option><option value="marketing">Marketing</option><option value="other">Outra</option></select></div><div class="form-group"><label class="form-label" for="user-telemetry-size">Tamanho da equipe</label><select class="form-select" id="user-telemetry-size"><option value="">Não informado</option><option value="solo">Só eu</option><option value="2-5">2–5 pessoas</option><option value="6-20">6–20 pessoas</option><option value="21+">21+ pessoas</option></select></div></div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="user-telemetry-consent"><span class="toggle-slider"></span> Concordo em compartilhar métricas operacionais pseudonimizadas para melhorar o i9Hub. Posso desativar quando quiser.</label></div>
 <div class="btn-group"><button class="btn btn-primary" id="user-telemetry-save"><i class="fas fa-save"></i> Salvar preferências de privacidade</button><span id="user-telemetry-status" class="text-muted" role="status"></span></div>
 </div>
 <div class="card">
 <div class="card-title"><i class="fas fa-graduation-cap"></i> Apresentação guiada</div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="tour-auto" data-feature="help.tour"><span class="toggle-slider"></span> Mostrar a apresentação ao abrir a extensão</label></div>
 <div class="btn-group"><button class="btn btn-secondary" id="tour-replay" data-feature="help.tour">Rever apresentação</button></div>
 </div>
 <div class="card">
 <div class="card-title"><i class="fas fa-message"></i> WhatsApp</div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="wa-embed" data-feature="whatsapp.connection"><span class="toggle-slider"></span> Usar WhatsApp embutido (experimental)</label></div>
 <div class="form-group"><label class="toggle"><input type="checkbox" id="wa-allow-hidden" data-feature="whatsapp.background_mode"><span class="toggle-slider"></span> Enviar em segundo plano (WhatsApp oculto ou coberto)</label></div>
 <p style="font-size:12px;opacity:.75;margin:0 0 8px">O WhatsApp Web roda numa aba ou janela comum, visível (padrão). O modo embutido (iframe) respondeu com erro HTTP 400 nos testes da v7.0.4: ligue só para testar.</p>
 <p style="font-size:12px;opacity:.75;margin:0">Ligado (padrão): a campanha continua enviando mesmo com a janela do WhatsApp coberta, minimizada ou em outra aba, usando o método interno do WhatsApp. Pode ficar mais lenta (o Chrome reduz o ritmo de páginas ocultas), e isso é normal. Se algum contato só puder ser enviado com a tela visível, a campanha espera o WhatsApp voltar a aparecer, sem contar falha. Desligado: a campanha só envia com o WhatsApp visível.</p>
 </div>
 </div>
 <div id="tab-data" class="tab-panel">
 <div class="card" data-feature="data.management">
 <div class="card-title"><i class="fas fa-database"></i> Gerenciamento de Dados</div>
 <div class="btn-group" style="flex-wrap: wrap;">
 <button class="btn btn-secondary" id="export-backup" data-feature="data.backup.manual"><i class="fas fa-download"></i> Exportar Backup</button>
 <button class="btn btn-secondary" id="import-backup" data-feature="data.backup.manual"><i class="fas fa-upload"></i> Importar Backup</button>
 <button class="btn btn-danger" id="clear-storage" data-feature="data.management"><i class="fas fa-trash"></i> Limpar Tudo</button>
 </div>
 <input type="file" id="backup-file" data-feature="data.backup.manual" accept=".json" style="display:none;">
 </div>
 <div class="card" id="drive-card" data-feature="drive.sync">
 <div class="card-title"><i class="fas fa-cloud"></i> Backup no Google Drive</div>
 <p style="font-size:12px;opacity:.8;margin:0 0 10px">Guarda leads, estágios, campanhas, preferências do Chat com IA e cadastros comerciais (vendedores, equipes, produtos e metas) no Google Drive. As chaves API só são incluídas se você definir uma senha de sincronização no Chat com IA; elas são criptografadas antes do envio. Em outro computador, conecte a mesma conta Google para mesclar os dados.</p>
 <div id="drive-status" class="license-status"></div>
 <div class="btn-group" style="flex-wrap: wrap; margin-top:10px;">
 <button class="btn btn-primary" id="drive-connect"><i class="fab fa-google-drive"></i> Conectar Google Drive</button>
 <button class="btn btn-secondary" id="drive-sync" style="display:none"><i class="fas fa-sync"></i> Sincronizar agora</button>
 <button class="btn btn-secondary" id="drive-disconnect" style="display:none"><i class="fas fa-unlink"></i> Desconectar</button>
 </div>
 <div class="form-group" id="drive-auto-wrap" style="display:none;margin-top:10px"><label class="toggle"><input type="checkbox" id="drive-auto"><span class="toggle-slider"></span> Sincronização automática</label></div>
 <details id="drive-advanced" style="display:none;margin-top:10px">
 <summary style="cursor:pointer;font-size:12px;opacity:.8">Opções avançadas</summary>
 <div class="btn-group" style="flex-wrap: wrap; margin-top:8px;">
 <button class="btn btn-secondary" id="drive-restore"><i class="fas fa-cloud-download-alt"></i> Restaurar do Drive (substitui os dados deste computador)</button>
 <button class="btn btn-secondary" id="drive-overwrite"><i class="fas fa-cloud-upload-alt"></i> Enviar este computador (substitui o Drive)</button>
 </div>
 </details>
 </div>
 <div class="card">
 <div class="card-title"><i class="fas fa-info-circle"></i> Sobre</div>
  <div class="about-line">i9Hub <strong>v${(typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? (chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version) : '1.0.0')}</strong></div>
 ${creditHTML("sobre")}
 </div>
 </div>
 <div id="tab-calendar" class="tab-panel" data-feature="google.calendar.connect">
  <div class="card" id="google-calendar-card">
   <div class="card-title"><i class="fas fa-calendar-days"></i> Integração com Google Agenda</div>
   <p class="text-muted" style="font-size:12px;margin:0 0 12px">Conecte sua conta Google para consultar horários livres e reservar compromissos diretamente nos cards do CRM. A autorização é feita na sua conta; o i9Hub não recebe sua senha.</p>
   <div id="google-calendar-status" class="license-status" role="status">Verificando integração...</div>
   <div class="btn-group" style="flex-wrap:wrap;margin-top:10px">
    <button type="button" class="btn btn-primary" id="google-calendar-connect"><i class="fab fa-google"></i> Conectar Google Agenda</button>
    <button type="button" class="btn btn-secondary" id="google-calendar-refresh" style="display:none"><i class="fas fa-rotate"></i> Atualizar agendas</button>
    <button type="button" class="btn btn-secondary" id="google-calendar-disconnect" style="display:none"><i class="fas fa-unlink"></i> Desconectar</button>
   </div>
  </div>
  <div class="card" id="google-calendar-preferences" data-feature="google.calendar.booking" style="display:none">
   <div class="card-title"><i class="fas fa-sliders"></i> Preferências de agendamento</div>
   <div class="form-group"><label class="form-label" for="google-calendar-select">Agenda para os compromissos</label><select class="form-select" id="google-calendar-select"></select></div>
   <div class="form-row">
    <div class="form-group"><label class="form-label" for="google-calendar-duration">Duração padrão</label><select class="form-select" id="google-calendar-duration"><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option></select></div>
    <div class="form-group"><label class="form-label" for="google-calendar-step">Intervalo entre opções</label><select class="form-select" id="google-calendar-step"><option value="5">5 minutos</option><option value="10">10 minutos</option><option value="15">15 minutos</option><option value="30">30 minutos</option></select></div>
   </div>
   <div class="form-row">
    <div class="form-group"><label class="form-label" for="google-calendar-start">Início do expediente</label><input class="form-input" id="google-calendar-start" type="time" value="09:00"></div>
    <div class="form-group"><label class="form-label" for="google-calendar-end">Fim do expediente</label><input class="form-input" id="google-calendar-end" type="time" value="18:00"></div>
   </div>
   <div class="form-group"><span class="form-label">Dias de atendimento</span><div class="calendar-weekdays"><label><input type="checkbox" value="1" checked> Seg</label><label><input type="checkbox" value="2" checked> Ter</label><label><input type="checkbox" value="3" checked> Qua</label><label><input type="checkbox" value="4" checked> Qui</label><label><input type="checkbox" value="5" checked> Sex</label><label><input type="checkbox" value="6"> Sáb</label><label><input type="checkbox" value="0"> Dom</label></div></div>
   <div class="form-group"><label class="form-label" for="google-calendar-reminder">Lembrete padrão</label><select class="form-select" id="google-calendar-reminder"><option value="5">5 minutos antes</option><option value="15">15 minutos antes</option><option value="30" selected>30 minutos antes</option><option value="60">1 hora antes</option><option value="120">2 horas antes</option><option value="1440">1 dia antes</option></select></div>
   <div class="form-group"><label class="toggle"><input type="checkbox" id="google-calendar-email-invite"><span class="toggle-slider"></span> Sugerir convite por e-mail do lead (sempre exige confirmação no agendamento)</label></div>
   <p class="text-muted" style="font-size:11px">Os horários livres são exibidos no fuso horário local deste navegador. Os lembretes são configurados no próprio Google Calendar.</p>
   <div class="btn-group"><button type="button" class="btn btn-primary" id="google-calendar-save"><i class="fas fa-save"></i> Salvar preferências</button></div>
  </div>
     <div class="card" id="calendar-automation-card" data-feature="google.calendar.automation">
    <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span><i class="fas fa-diagram-project"></i> Automações por estágio e etiqueta</span><button type="button" class="btn btn-sm btn-secondary" id="calendar-auto-refresh"><i class="fas fa-rotate"></i> Atualizar</button></div>
    <p class="text-muted" style="font-size:12px">Crie regras para gerar compromissos ou solicitar uma ação do vendedor quando um lead entrar em uma etapa ou receber uma nova etiqueta. As regras só disparam em transições novas; etiquetas antigas não são reprocessadas em cada sincronização.</p>
    <div class="calendar-automation-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px">
     <label class="form-group"><span class="form-label">Nome da regra</span><input class="form-input" id="calendar-auto-name" maxlength="100" placeholder="Ex.: Retorno após proposta"></label>
     <label class="form-group"><span class="form-label">Disparar quando</span><select class="form-select" id="calendar-auto-trigger-type"><option value="stage">Lead entrar em uma etapa</option><option value="tag">Lead receber uma etiqueta</option></select></label>
     <label class="form-group" id="calendar-auto-stage-wrap"><span class="form-label">Etapa do CRM</span><select class="form-select" id="calendar-auto-stage-value"></select></label>
     <label class="form-group" id="calendar-auto-tag-wrap" style="display:none"><span class="form-label">Etiqueta exata</span><input class="form-input" id="calendar-auto-tag-value" list="calendar-auto-tags" maxlength="120" placeholder="Ex.: visita"><datalist id="calendar-auto-tags"></datalist></label>
     <label class="form-group"><span class="form-label">Ação</span><select class="form-select" id="calendar-auto-action"><option value="create_relative_event">Criar compromisso após um intervalo</option><option value="request_booking">Solicitar agendamento ao vendedor</option><option value="create_event_from_lead">Criar compromisso usando data/hora do card</option></select></label>
     <label class="form-group" id="calendar-auto-offset-wrap"><span class="form-label">Intervalo</span><div style="display:flex;gap:6px"><input class="form-input" id="calendar-auto-offset" type="number" min="1" max="365" value="2" style="min-width:70px"><select class="form-select" id="calendar-auto-offset-unit"><option value="days">Dias</option><option value="hours">Horas</option></select></div></label>
     <label class="form-group" id="calendar-auto-time-wrap"><span class="form-label">Horário preferencial</span><input class="form-input" id="calendar-auto-time" type="time" value="10:00"></label>
     <label class="form-group" id="calendar-auto-date-field-wrap" style="display:none"><span class="form-label">Campo de data no card</span><input class="form-input" id="calendar-auto-date-field" maxlength="100" value="appointmentDate" placeholder="appointmentDate"></label>
     <label class="form-group" id="calendar-auto-time-field-wrap" style="display:none"><span class="form-label">Campo de horário no card</span><input class="form-input" id="calendar-auto-time-field" maxlength="100" value="appointmentTime" placeholder="appointmentTime"></label><small class="text-muted" style="grid-column:1/-1">Para essa ação, os campos do card devem conter data no formato AAAA-MM-DD e horário no formato HH:mm. Também são aceitos campos personalizados do CRM.</small>
     <label class="form-group"><span class="form-label">Duração</span><select class="form-select" id="calendar-auto-duration"><option value="15">15 minutos</option><option value="30" selected>30 minutos</option><option value="45">45 minutos</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option></select></label>
     <label class="form-group"><span class="form-label">Título do evento</span><input class="form-input" id="calendar-auto-summary" maxlength="200" value="Retorno comercial — {{nome}}"></label>
    </div>
    <div class="form-group" style="margin-top:8px"><label class="form-label" for="calendar-auto-note">Descrição / observação do compromisso</label><textarea class="form-input" id="calendar-auto-note" rows="2" maxlength="1200" placeholder="Ex.: Retornar sobre a proposta de {{servico}}."></textarea></div>
    <div style="display:flex;flex-wrap:wrap;gap:14px;margin:8px 0">
     <label class="toggle"><input type="checkbox" id="calendar-auto-approval"><span class="toggle-slider"></span> Exigir aprovação do vendedor</label>
     <label class="toggle"><input type="checkbox" id="calendar-auto-confirmation"><span class="toggle-slider"></span> Enviar confirmação pelo WhatsApp após criar o evento</label>
    </div>
    <p class="text-muted" style="font-size:11px">A confirmação pelo WhatsApp é opcional e só será enviada se houver consentimento válido, contato fora da Black list e limites de frequência disponíveis. Convites por e-mail não são enviados por estas automações.</p>
    <div class="btn-group" style="flex-wrap:wrap"><button type="button" class="btn btn-primary" id="calendar-auto-save"><i class="fas fa-plus"></i> Salvar regra</button><button type="button" class="btn btn-secondary" id="calendar-auto-reset" style="display:none">Cancelar edição</button></div>
    <div style="margin-top:18px"><h4 style="margin:0 0 8px">Regras cadastradas</h4><div id="calendar-automation-rules"><div class="crm-history-empty">Carregando regras...</div></div></div>
    <div style="margin-top:18px"><h4 style="margin:0 0 8px">Ações aguardando revisão</h4><div id="calendar-automation-tasks"><div class="crm-history-empty">Carregando pendências...</div></div></div>
   </div>
<div class="card"><div class="card-title"><i class="fas fa-shield-halved"></i> Privacidade e funcionamento</div><p class="text-muted" style="font-size:12px;margin:0">O i9Hub acessa somente os calendários autorizados pela conta conectada. Não adiciona o e-mail do lead como participante sem sua confirmação. Criar ou cancelar um evento não envia mensagem pelo WhatsApp automaticamente.</p></div>
 </div>
 </div>`;
  }

  async loadSettings() {
    try {
      const res = await this.app.api.getSettings();
      if (res.success) {
        this.settings = res.data || {};
        this.populateForm();
      }
    } catch (error) {
      console.error("[Settings] Erro ao carregar:", error);
    }
    this.updateLicenseStatus();
    await this.loadTelemetryPreferences();
  }

  async loadTelemetryPreferences() {
    const result = await this.app.api.sendMessage("TELEMETRY_GET_PROFILE");
    const profile = result?.success ? (result.data || {}) : {};
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value || ""; };
    set("user-telemetry-industry", profile.industry);
    set("user-telemetry-role", profile.role);
    set("user-telemetry-size", profile.companySize);
    const consent = document.getElementById("user-telemetry-consent"); if (consent) consent.checked = profile.consent === true;
    const status = document.getElementById("user-telemetry-status"); if (status) status.textContent = profile.consent === true ? "Compartilhamento ativado" : "Compartilhamento desativado";
  }

  async saveTelemetryPreferences() {
    const payload = {
      industry: document.getElementById("user-telemetry-industry")?.value || "",
      role: document.getElementById("user-telemetry-role")?.value || "",
      companySize: document.getElementById("user-telemetry-size")?.value || "",
      consent: document.getElementById("user-telemetry-consent")?.checked === true,
      updatedAt: new Date().toISOString(),
    };
    const result = await this.app.api.sendMessage("TELEMETRY_SAVE_PROFILE", payload);
    const status = document.getElementById("user-telemetry-status");
    if (status) status.textContent = result?.success ? (payload.consent ? "Preferências salvas · compartilhamento ativado" : "Preferências salvas · compartilhamento desativado") : (result?.error || "Não foi possível salvar.");
    this.app.showToast(result?.success ? "Preferências de privacidade salvas." : (result?.error || "Não foi possível salvar as preferências."), result?.success ? "success" : "error");
  }

  populateForm() {
    document.getElementById("license-key").value = this.settings.licenseKey || "";
    document.getElementById("webhook-url").value = this.settings.webhookUrl || "";
    document.getElementById("webhook-method").value = this.settings.webhookMethod || "POST";
    document.getElementById("webhook-content-type").value = this.settings.webhookContentType || "application/json";
    document.getElementById("webhook-headers").value = JSON.stringify(this.settings.webhookHeaders || {}, null, 2);
    document.getElementById("webhook-api-key").value = this.settings.webhookApiKey || "";
    document.getElementById("delay-msg-min").value = this.settings.delayMsgMin || 2000;
    document.getElementById("delay-msg-max").value = this.settings.delayMsgMax || 5000;
    document.getElementById("delay-contact-min").value = this.settings.delayContactMin || 5000;
    document.getElementById("delay-contact-max").value = this.settings.delayContactMax || 15000;
    document.getElementById("delay-error-min").value = this.settings.delayErrorMin || 30000;
    document.getElementById("delay-error-max").value = this.settings.delayErrorMax || 60000;
    document.getElementById("dark-theme").checked = this.settings.darkTheme || false;
    document.getElementById("compact-mode").checked = this.settings.compactMode || false;
    (async () => {
      let r = {};
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        try { r = await chrome.storage.local.get(["waEmbedExperimental", "waAllowHidden"]); } catch {}
      } else {
        try {
          const emb = localStorage.getItem('i9hub_waEmbedExperimental');
          const ah = localStorage.getItem('i9hub_waAllowHidden');
          if (emb !== null) r.waEmbedExperimental = JSON.parse(emb);
          if (ah !== null) r.waAllowHidden = JSON.parse(ah);
        } catch {}
      }
      const el = document.getElementById("wa-embed"); if (el) el.checked = r.waEmbedExperimental === true;
      const ahEl = document.getElementById("wa-allow-hidden"); if (ahEl) ahEl.checked = r.waAllowHidden !== false;
    })();
    this.renderSpintaxPresets();
    this.populateClassifierForm();
    this.applyTheme();
  }

  populateClassifierForm() {
    const c = normalizeClassifierSettings(this.settings.classifier || DEFAULT_CLASSIFIER_SETTINGS);
    const $ = (id) => document.getElementById(id);
    if ($("spam-keywords")) $("spam-keywords").value = c.spamKeywords.join("\n");
    if ($("spam-flood-count")) $("spam-flood-count").value = c.floodMessageCount;
    if ($("spam-flood-window")) $("spam-flood-window").value = c.floodWindowSeconds;
    if ($("spam-same-message")) $("spam-same-message").value = c.sameMessageNumbers;
    if ($("spam-recent-days")) $("spam-recent-days").value = c.recentDays;
    if ($("spam-shortened-link")) $("spam-shortened-link").checked = c.shortenedLinkFirstMessage;
    if ($("spam-promo-first")) $("spam-promo-first").checked = c.promotionalFirstMessage;
    if ($("spam-outside-contact")) $("spam-outside-contact").checked = c.outsideContactsNeverReplied;
  }

  readClassifierForm() {
    const $ = (id) => document.getElementById(id);
    return normalizeClassifierSettings({
      spamKeywords: ($("spam-keywords")?.value || "").split(/\r?\n|[,;]+/),
      floodMessageCount: $("spam-flood-count")?.value,
      floodWindowSeconds: $("spam-flood-window")?.value,
      sameMessageNumbers: $("spam-same-message")?.value,
      recentDays: $("spam-recent-days")?.value,
      shortenedLinkFirstMessage: $("spam-shortened-link")?.checked,
      promotionalFirstMessage: $("spam-promo-first")?.checked,
      outsideContactsNeverReplied: $("spam-outside-contact")?.checked,
    });
  }

  async saveClassifier() {
    this.settings.classifier = this.readClassifierForm();
    if (!(await this.saveSettings())) return;
    const r = await this.app.api.reclassifyLeads();
    this.app.showToast(r.success ? "Regras salvas e leads reclassificados." : "Regras salvas. Reclassificação falhou: " + (r.error || "erro"), r.success ? "success" : "warning", 7000);
    if (r.success) this.app.views.crm?.loadLeads?.();
  }

  async reclassifyLeads() {
    const btn = document.getElementById("reclassify-leads");
    const old = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reclassificando...'; }
    try {
      const r = await this.app.api.reclassifyLeads();
      this.app.showToast(r.success ? `${r.data?.total || 0} leads analisados.` : (r.error || "Não foi possível reclassificar."), r.success ? "success" : "error", 6000);
      if (r.success) this.app.views.crm?.loadLeads?.();
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = old; }
    }
  }

  resetClassifier() {
    if (!confirm("Restaurar as regras padrão do classificador?")) return;
    this.settings.classifier = { ...DEFAULT_CLASSIFIER_SETTINGS, spamKeywords: [...DEFAULT_CLASSIFIER_SETTINGS.spamKeywords] };
    this.populateClassifierForm();
    this.saveClassifier();
  }

  renderSpintaxPresets() {
    const container = document.getElementById("spintax-presets");
    const presets = this.settings.spintaxPresets || [
      { name: "Saudacao", template: "Oi {{nome}}! {Tudo bem?|Como vai?|Espero que esteja bem}." },
      { name: "Despedida", template: "{Obrigado|Agradeco} {{nome}}! {Ate mais|Tenha um otimo dia|Fico no aguardo}." }
    ];
    container.innerHTML = presets.map((p, i) => `<div class="preset-item" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
 <input type="text" class="form-input" style="width: 150px;" value="${this.escapeHtml(p.name)}" data-index="${i}" data-field="name">
 <textarea class="form-textarea" style="flex: 1; min-height: 60px;" data-index="${i}" data-field="template">${this.escapeHtml(p.template)}</textarea>
 <button class="btn-icon btn-danger" data-action="delete" data-index="${i}"><i class="fas fa-trash"></i></button>
 </div>`).join("");
  }

  applyTheme() {
    const theme = this.settings.darkTheme ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    if (document.body) document.body.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", this.settings.darkTheme);
    document.documentElement.classList.toggle("compact", this.settings.compactMode);
  }

  async updateLicenseStatus() {
    const container = document.getElementById("settings-license-status");
    if (!container) return;
    const res = await this.app.api.getLicenseStatus();
    const status = res?.data || {};
    if (status.licensed && status.entitlementsConfigured) {
      const count = Array.isArray(status.features) ? status.features.filter((feature) => feature.enabled && feature.implemented).length : (status.entitlements || []).length;
      container.innerHTML = `<div class="status-badge success"><i class="fas fa-key"></i> Licença ativa - plano ${this.escapeHtml(String(status.plan || "licenciado").toUpperCase())}; ${count} função(ões) liberada(s)</div>`;
    } else if (status.licensed) {
      container.innerHTML = `<div class="status-badge warning"><i class="fas fa-triangle-exclamation"></i> Licença válida, mas as permissões precisam ser configuradas no painel administrativo.</div>`;
    } else {
      container.innerHTML = `<div class="status-badge warning"><i class="fas fa-user-lock"></i> Modo de demonstração. Solicite uma conta gratuita e ative a licença emitida pelo painel.</div>`;
    }
  }

  bindEvents() {
    document.getElementById("go-business-profile")?.addEventListener("click", () => this.app.router.navigate("business-profile"));
 const d=document.getElementById("diagnostic-btn");
 if(d) d.onclick=()=>this.app.router.navigate("logs");
    // v1.2.0-pro: modo privacidade (blur)
    const privMap = { "priv-on": "on", "priv-names": "names", "priv-messages": "messages", "priv-photos": "photos", "priv-panel": "panel", "priv-hover": "hover" };
    const syncPriv = (c) => { Object.entries(privMap).forEach(([id, k]) => { const el = document.getElementById(id); if (el) el.checked = k === "on" ? !!c[k] : c[k] !== false; }); };
    syncPriv(Privacy.cfg);
    if (this._privOff) this._privOff();
    this._privOff = Privacy.onChange(syncPriv);
    Object.entries(privMap).forEach(([id, k]) => document.getElementById(id)?.addEventListener("change", (e) => Privacy.set({ [k]: e.target.checked })));
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => this.switchTab(btn.dataset.tab));
    });
    document.getElementById("validate-license")?.addEventListener("click", () => this.validateLicense());
    document.getElementById("settings-upgrade-btn")?.addEventListener("click", () => this.app.requestWhatsApp(this.app.state.get("license")?.licensed ? "license-support" : "free-account"));
    document.getElementById("save-webhook")?.addEventListener("click", () => this.saveWebhook());
    document.getElementById("test-webhook")?.addEventListener("click", () => this.testWebhook());
    document.getElementById("save-delays")?.addEventListener("click", () => this.saveDelays());
    document.getElementById("add-preset")?.addEventListener("click", () => this.addPreset());
    document.getElementById("save-classifier")?.addEventListener("click", () => this.saveClassifier());
    document.getElementById("reclassify-leads")?.addEventListener("click", () => this.reclassifyLeads());
    document.getElementById("reset-classifier")?.addEventListener("click", () => this.resetClassifier());
    document.getElementById("spintax-presets")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action=\"delete\"]");
      if (btn) this.deletePreset(parseInt(btn.dataset.index));
    });
    document.getElementById("spintax-presets")?.addEventListener("change", (e) => {
      const input = e.target.closest("input[data-index], textarea[data-index]");
      if (input) this.updatePreset(parseInt(input.dataset.index), input.dataset.field, input.value);
    });
    document.getElementById("dark-theme")?.addEventListener("change", (e) => {
      this.settings.darkTheme = e.target.checked;
      this.saveSettings();
      this.applyTheme();
    });
    document.getElementById("compact-mode")?.addEventListener("change", (e) => {
      this.settings.compactMode = e.target.checked;
      this.saveSettings();
      this.applyTheme();
    });
    document.getElementById("wa-embed")?.addEventListener("change", async (e) => {
      const on = e.target.checked;
      if (on && !confirm("O WhatsApp embutido é experimental e, nos testes, o WhatsApp respondeu com erro. Ligar mesmo assim?")) { e.target.checked = false; return; }
      await this.app.waDock?.applyEmbedSetting(on);
      this.app.showToast(on ? "WhatsApp embutido (experimental) ligado." : "WhatsApp embutido desligado: o WhatsApp usa aba/janela comum.", "success");
    });
    document.getElementById("wa-allow-hidden")?.addEventListener("change", async (e) => {
      await this.app.api.sendMessage("WA_SET_ALLOW_HIDDEN", { enabled: e.target.checked });
      this.app.showToast(e.target.checked ? "Segundo plano ligado: o envio segue mesmo com o WhatsApp oculto ou coberto." : "Segundo plano desligado: o envio só acontece com o WhatsApp visível.", "success");
    });
    document.getElementById("export-backup")?.addEventListener("click", () => this.exportBackup());
    document.getElementById("import-backup")?.addEventListener("click", () => document.getElementById("backup-file").click());
    document.getElementById("backup-file")?.addEventListener("change", (e) => this.importBackup(e.target.files[0]));
    document.getElementById("clear-storage")?.addEventListener("click", () => this.clearStorage());
    document.getElementById("user-telemetry-save")?.addEventListener("click", () => this.saveTelemetryPreferences());
    this.bindDrive();
    this.bindCalendar();
    this.bindCalendarAutomation();
    const tourAuto = document.getElementById("tour-auto");
    if (tourAuto) {
      this.app.tour?.getState().then((st) => { tourAuto.checked = !st.hidden && !st.completed && st.skips < 2; });
      tourAuto.addEventListener("change", async (e) => {
        // Ligar = volta a abrir sozinha na próxima vez; desligar = nunca mais abre sozinha.
        await this.app.tour?.setState(e.target.checked ? { hidden: false, completed: false, skips: 0 } : { hidden: true });
        this.app.showToast(e.target.checked ? "A apresentação vai abrir na próxima vez." : "A apresentação não abrirá mais sozinha. Use \"Rever apresentação\" quando quiser.", "success");
      });
    }
    document.getElementById("tour-replay")?.addEventListener("click", () => this.app.tour?.start());
  }

  // ---------------------------------------------------------------- Google Drive (v7.2.0 / Fase 12)
  bindDrive() {
    const $ = (id) => document.getElementById(id);
    if (!$("drive-card")) return;
    this.refreshDrive();
    if (!this._driveListener) {
      this._driveListener = (m) => { if (m?.type === "DRIVE_STATUS") this.refreshDrive(); };
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener(this._driveListener);
      }
    }
    const run = async (btn, msg, type, okText, confirmText) => {
      if (confirmText && !confirm(confirmText)) return;
      const label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aguarde...';
      const r = await this.app.api.sendMessage(type);
      btn.disabled = false; btn.innerHTML = label;
      if (r.success && !r.skipped) {
        const n = r.data?.pulled || 0;
        const commercial = r.data?.managementChanged ? " Cadastros comerciais, metas e probabilidades do funil também foram atualizados." : "";
        const communication = r.data?.communicationChanged ? " Modelos de e-mail e assinaturas por vendedor também foram atualizados." : "";
        this.app.showToast(okText + (n ? ` (${n} lead(s) trazido(s) do Drive)` : "") + commercial + communication, "success");
        if (r.data?.changedLocal) setTimeout(() => location.reload(), 1200);
      } else if (r.success && r.skipped) {
        this.app.showToast(r.error || "Sincronização adiada: há uma campanha em andamento.", "warning");
      } else { this.app.showToast(r.error || "Falha na sincronização", "error"); }
      this.refreshDrive();
    };
    $("drive-connect").onclick = (e) => run(e.currentTarget, null, "DRIVE_CONNECT", "Google Drive conectado!");
    $("drive-sync").onclick = (e) => run(e.currentTarget, null, "DRIVE_SYNC_NOW", "Sincronizado com o Google Drive!");
    $("drive-restore").onclick = (e) => run(e.currentTarget, null, "DRIVE_RESTORE", "Dados restaurados do Drive!", "Isso SUBSTITUI os leads, campanhas, vendedores, equipes, produtos, metas e probabilidades comerciais deste computador pelos dados do Google Drive. Continuar?");
    $("drive-overwrite").onclick = (e) => run(e.currentTarget, null, "DRIVE_OVERWRITE", "Drive atualizado com os dados deste computador!", "Isso SUBSTITUI os backups do Google Drive pelos dados deste computador, incluindo vendedores, equipes, produtos, metas e probabilidades comerciais. O Drive mantém instantâneos diários dos últimos 7 dias. Continuar?");
    $("drive-disconnect").onclick = async () => {
      if (!confirm("Desconectar o Google Drive? Os dados locais e o backup já salvo no Drive continuam como estão; só a sincronização para.")) return;
      await this.app.api.sendMessage("DRIVE_DISCONNECT"); this.refreshDrive(); this.app.showToast("Google Drive desconectado.", "success");
    };
    $("drive-auto").onchange = async (e) => { await this.app.api.sendMessage("DRIVE_SET_AUTO", { enabled: e.target.checked }); this.refreshDrive(); };
  }

  async refreshDrive() {
    const $ = (id) => document.getElementById(id);
    if (!$("drive-status")) return;
    const r = await this.app.api.sendMessage("DRIVE_GET_STATUS");
    const d = r?.data || {};
    const fmt = (t) => { try { return new Date(t).toLocaleString("pt-BR"); } catch { return "-"; } };
    let html;
    if (!d.connected) {
      html = d.configured === false
        ? '<div class="status-badge warning"><i class="fas fa-exclamation-triangle"></i> Falta configurar o Client ID do Google no manifest.json (veja o LEIA-ME).</div>'
        : '<div class="status-badge warning"><i class="fas fa-cloud"></i> Não conectado — seus dados estão só neste computador.</div>';
    } else {
      const err = d.lastError;
      const local = d.local || {};
      const remote = d.remote || {};
      const remoteManagement = d.remoteManagement || {};
      const remoteCommunication = d.remoteCommunication || {};
      html = `<div class="status-badge ${err ? "warning" : "success"}"><i class="fas fa-cloud"></i> Conectado${d.email ? " como <strong>" + this.escapeHtml(d.email) + "</strong>" : ""} · pasta "${this.escapeHtml(d.folder || "")}" · última sincronização: ${d.lastSyncAt ? fmt(d.lastSyncAt) : "ainda não"}</div>`
        + `<div style="font-size:12px;opacity:.8;margin-top:6px">Neste computador: ${local.leads || 0} leads, ${local.campaigns || 0} campanhas, ${local.sellers || 0} vendedores, ${local.teams || 0} equipes, ${local.products || 0} produtos/serviços, ${local.goals || 0} metas e ${local.stageProbabilities || 0} probabilidades de etapa.</div>`
        + `<div style="font-size:12px;opacity:.8;margin-top:4px">Neste computador: ${local.emailTemplates || 0} modelos de e-mail e ${local.sellerSignatures || 0} assinaturas de vendedores.</div>`
        + `<div style="font-size:12px;opacity:.8;margin-top:4px">No Drive: ${remote.leads || 0} leads, ${remote.campaigns || 0} campanhas, ${remoteManagement.sellers || 0} vendedores, ${remoteManagement.teams || 0} equipes, ${remoteManagement.products || 0} produtos/serviços, ${remoteManagement.goals || 0} metas, ${remoteManagement.stageProbabilities || 0} probabilidades de etapa, ${remoteCommunication.templates || 0} modelos de e-mail e ${remoteCommunication.sellerSignatures || 0} assinaturas.</div>`
        + (err ? `<div class="status-badge error" style="margin-top:6px"><i class="fas fa-times-circle"></i> ${this.escapeHtml(err.message || "Erro")}${d.paused ? " Clique em \"Sincronizar agora\" para retomar." : ""}</div>` : "");    }
    $("drive-status").innerHTML = html;
    $("drive-connect").style.display = d.connected ? "none" : "";
    ["drive-sync", "drive-disconnect"].forEach((id) => { $(id).style.display = d.connected ? "" : "none"; });
    $("drive-auto-wrap").style.display = d.connected ? "" : "none";
    $("drive-advanced").style.display = d.connected ? "" : "none";
    $("drive-auto").checked = !!d.auto;
  }

  bindCalendar() {
    if (!this.app.hasFeature?.('google.calendar.connect')) return;
    const connect = document.getElementById('google-calendar-connect');
    const refresh = document.getElementById('google-calendar-refresh');
    const disconnect = document.getElementById('google-calendar-disconnect');
    const save = document.getElementById('google-calendar-save');
    connect?.addEventListener('click', async () => {
      const original = connect.innerHTML; connect.disabled = true; connect.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Conectando...';
      try {
        const granted = await chrome.permissions.request({ origins: ['https://www.googleapis.com/*'] });
        if (!granted) { this.app.showToast('A permissão do Google Agenda não foi concedida.', 'warning'); return; }
        const result = await this.app.api.sendMessage('CALENDAR_CONNECT');
        if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível conectar ao Google Agenda.', 'error', 7000); return; }
        this.app.showToast('Google Agenda conectado.', 'success');
        await this.refreshCalendar(result.data?.calendars || []);
      } catch (error) { this.app.showToast(error?.message || 'Falha ao conectar Google Agenda.', 'error', 7000); }
      finally { connect.disabled = false; connect.innerHTML = original; }
    });
    refresh?.addEventListener('click', () => this.refreshCalendar());
    disconnect?.addEventListener('click', async () => {
      if (!confirm('Desconectar o Google Agenda deste navegador? Os compromissos já criados continuarão na sua conta Google.')) return;
      const result = await this.app.api.sendMessage('CALENDAR_DISCONNECT');
      this.app.showToast(result?.success ? 'Google Agenda desconectado.' : (result?.error || 'Não foi possível desconectar.'), result?.success ? 'success' : 'error');
      await this.refreshCalendar();
    });
    save?.addEventListener('click', async () => {
      const weekdays = [...document.querySelectorAll('.calendar-weekdays input:checked')].map((input) => Number(input.value));
      const settings = {
        calendarId: document.getElementById('google-calendar-select')?.value || 'primary',
        defaultDurationMinutes: Number(document.getElementById('google-calendar-duration')?.value || 30),
        slotStepMinutes: Number(document.getElementById('google-calendar-step')?.value || 15),
        workingHoursStart: document.getElementById('google-calendar-start')?.value || '09:00',
        workingHoursEnd: document.getElementById('google-calendar-end')?.value || '18:00',
        weekdays,
        reminderMinutes: [Number(document.getElementById('google-calendar-reminder')?.value || 30)],
        inviteLeadByEmail: document.getElementById('google-calendar-email-invite')?.checked === true,
      };
      save.disabled = true;
      const result = await this.app.api.sendMessage('CALENDAR_SAVE_SETTINGS', { settings });
      save.disabled = false;
      this.app.showToast(result?.success ? 'Preferências do Google Agenda salvas.' : (result?.error || 'Não foi possível salvar.'), result?.success ? 'success' : 'error', 6000);
      if (result?.success) await this.refreshCalendar();
    });
    this.refreshCalendar();
  }

  async refreshCalendar(providedCalendars = null) {
    const status = document.getElementById('google-calendar-status');
    if (!status) return;
    const result = await this.app.api.sendMessage('CALENDAR_GET_STATUS');
    const config = result?.data || {};
    const connected = config.connected === true && config.permissionGranted === true;
    const connect = document.getElementById('google-calendar-connect');
    const refresh = document.getElementById('google-calendar-refresh');
    const disconnect = document.getElementById('google-calendar-disconnect');
    const preferences = document.getElementById('google-calendar-preferences');
    if (!config.configured) status.innerHTML = '<div class="status-badge warning">O Client ID OAuth do Google precisa estar configurado no manifesto da extensão.</div>';
    else if (config.connected === true && config.permissionGranted !== true) status.innerHTML = '<div class="status-badge warning"><i class="fas fa-triangle-exclamation"></i> A permissão de acesso ao Google Agenda não está disponível. Conecte novamente para autorizar.</div>';
    else if (!connected) status.innerHTML = '<div class="status-badge warning"><i class="fas fa-calendar"></i> Google Agenda não conectado neste navegador.</div>';
    else status.innerHTML = `<div class="status-badge success"><i class="fas fa-calendar-check"></i> Conectado · Agenda: <strong>${this.escapeHtml(config.calendarSummary || config.calendarId)}</strong></div><small class="text-muted">Fuso horário local: ${this.escapeHtml(config.timeZone || 'local')}</small>`;
    if (connect) connect.style.display = connected ? 'none' : '';
    if (refresh) refresh.style.display = connected ? '' : 'none';
    if (disconnect) disconnect.style.display = connected ? '' : 'none';
    if (preferences) preferences.style.display = connected ? '' : 'none';
    if (!connected) return;
    let calendars = Array.isArray(providedCalendars) ? providedCalendars : [];
    if (!calendars.length) {
      const list = await this.app.api.sendMessage('CALENDAR_LIST_CALENDARS');
      if (!list?.success) {
        status.innerHTML = `<div class="status-badge warning"><i class="fas fa-triangle-exclamation"></i> ${this.escapeHtml(list?.error || 'Não foi possível listar as agendas. Conecte novamente ou verifique a configuração do Google Cloud.')}</div>`;
        if (preferences) preferences.style.display = 'none';
        if (connect) { connect.style.display = ''; connect.innerHTML = '<i class="fab fa-google"></i> Reconectar Google Agenda'; }
        return;
      }
      calendars = Array.isArray(list.data) ? list.data : [];
    }
    const select = document.getElementById('google-calendar-select');
    if (select) {
      const writable = calendars.filter((item) => ['owner', 'writer'].includes(item.accessRole));
      select.innerHTML = writable.map((item) => `<option value="${this.escapeHtml(item.id)}">${this.escapeHtml(item.summary)}${item.primary ? ' (principal)' : ''}</option>`).join('') || '<option value="">Nenhuma agenda editável encontrada</option>';
      select.value = writable.some((item) => item.id === config.calendarId) ? config.calendarId : (writable.find((item) => item.primary)?.id || writable[0]?.id || '');
    }
    const set = (id, value) => { const element = document.getElementById(id); if (element && value != null) element.value = String(value); };
    set('google-calendar-duration', config.defaultDurationMinutes || 30);
    set('google-calendar-step', config.slotStepMinutes || 15);
    set('google-calendar-start', config.workingHoursStart || '09:00');
    set('google-calendar-end', config.workingHoursEnd || '18:00');
    set('google-calendar-reminder', config.reminderMinutes?.[0] || 30);
    const invite = document.getElementById('google-calendar-email-invite'); if (invite) invite.checked = config.inviteLeadByEmail === true;
    const days = new Set(config.weekdays || [1, 2, 3, 4, 5]);
    document.querySelectorAll('.calendar-weekdays input').forEach((input) => { input.checked = days.has(Number(input.value)); });
  }

  followupStepHTML(index = 0) {
    const removable = index > 0;
    return `<div class="crm-followup-step" data-followup-step>
      <div class="crm-followup-step-head"><strong>Etapa <span data-step-number>${index + 1}</span></strong>${removable ? '<button type="button" class="btn btn-sm btn-danger" data-step-remove><i class="fas fa-trash"></i> Remover</button>' : ''}</div>
      <div class="crm-followup-schedule-grid">
        <label>Enviar após
          <div class="crm-followup-delay"><input class="form-input" type="number" min="1" max="525600" value="${index === 0 ? 1 : 3}" data-step-value><select class="form-select" data-step-unit><option value="minutes">minutos</option><option value="hours">horas</option><option value="days" selected>dias</option></select></div>
        </label>
        <label>Ou em data e hora específicas
          <input class="form-input" type="datetime-local" data-step-datetime>
        </label>
      </div>
      <label class="crm-followup-message-label">Mensagem
        <textarea class="form-input" rows="3" maxlength="2500" data-step-message placeholder="Escreva a mensagem de acompanhamento...">${index === 0 ? 'Olá, {{nome}}! Passando para saber se conseguiu avaliar as informações que conversamos. Se tiver alguma dúvida, estou à disposição.' : ''}</textarea>
      </label>
      <small class="text-muted">Variáveis: {{nome}}, {{empresa}}, {{servico}}, {{nicho}}, {{proposta}}, {{vendedor}}.</small>
    </div>`;
  }

  followupHTML(lead) {
    const canManage = this.app.hasFeature?.('crm.followup.manage') === true;
    const canSend = this.app.hasFeature?.('crm.followup.send') === true;
    const phone = String(lead.phone || '').replace(/\D/g, '');
    if (!canManage) {
      return `<section class="form-section crm-followup-section" data-feature="crm.followup.manage"><div class="form-section-title"><i class="fas fa-clock"></i> Follow-up programado</div><p class="text-muted">Este módulo depende de uma licença que inclua gerenciamento de follow-ups.</p><button type="button" class="btn btn-secondary" data-followup-unlock="crm.followup.manage">Conhecer funcionalidade</button></section>`;
    }
    return `<section class="form-section crm-followup-section" data-feature="crm.followup.manage">
      <div class="form-section-title"><i class="fas fa-clock"></i> Follow-up programado</div>
      <p class="text-muted" style="font-size:12px">Programe retornos individuais ou uma sequência. O envio só acontece com Chrome e WhatsApp Web conectados, autorização registrada e dentro dos limites de segurança.</p>
      ${!canSend ? '<div class="crm-followup-warning">Sua licença permite gerenciar follow-ups, mas não libera o envio de mensagens.</div>' : ''}
      <div class="crm-followup-composer">
        <div class="crm-followup-composer-head"><strong>Nova sequência</strong><span>Até 10 etapas</span></div>
        <div class="crm-followup-steps" id="crm-followup-steps">${this.followupStepHTML(0)}</div>
        <div class="crm-followup-composer-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="crm-followup-add-step"><i class="fas fa-plus"></i> Adicionar etapa</button>
        </div>
        <label class="crm-followup-check"><input type="checkbox" id="crm-followup-consent"> Confirmo que tenho autorização para enviar mensagens a este contato.</label>
        <label class="crm-followup-check"><input type="checkbox" id="crm-followup-cancel-on-reply" checked> Interromper automaticamente a sequência quando o cliente responder.</label>
        <div class="crm-followup-footer">
          <small>O sistema não enviará se houver descadastro, Black list, spam ou limite de frequência.</small>
          <button type="button" class="btn btn-primary" id="crm-followup-schedule" ${canSend && phone.length >= 10 ? '' : 'disabled'}><i class="fas fa-calendar-check"></i> Agendar follow-up</button>
        </div>
        ${phone.length < 10 ? '<small class="crm-followup-warning">Cadastre um telefone válido no lead para programar mensagens.</small>' : ''}
      </div>
      <div class="crm-followup-list-wrap">
        <div class="crm-followup-list-head"><strong>Agendamentos deste lead</strong><button type="button" class="btn btn-sm btn-secondary" id="crm-followup-refresh"><i class="fas fa-rotate"></i> Atualizar</button></div>
        <div id="crm-followup-list" class="crm-followup-list"><div class="crm-history-empty">Carregando follow-ups...</div></div>
      </div>
    </section>`;
  }

  async loadFollowups(modal, lead) {
    const container = modal.querySelector('#crm-followup-list');
    if (!container || !this.app.hasFeature?.('crm.followup.manage')) return;
    const [result, templatesResult] = await Promise.all([
      this.app.api.getFollowups({ leadId: String(lead.id || lead.placeId || lead.phone || ''), limit: 50 }),
      this.app.api.getFollowupTemplates(),
    ]);
    this.followupTemplates = Array.isArray(templatesResult?.data) ? templatesResult.data : [];
    if (!result?.success) {
      container.innerHTML = `<div class="crm-history-empty">${this.escapeHtml(result?.error || 'Não foi possível carregar os follow-ups.')}</div>`;
      return;
    }
    const statusLabels = {
      scheduled: 'Agendado', processing: 'Enviando', sent: 'Enviado', failed: 'Falha no envio',
      overdue: 'Aguardando ação', cancelled: 'Cancelado', blocked_consent: 'Sem consentimento',
      blocked_blacklist: 'Black list', blocked_spam: 'Contato bloqueado', blocked_license: 'Licença sem permissão',
      blocked_frequency: 'Limite de frequência',
    };
    const items = result.data?.items || [];
    container.innerHTML = items.length ? items.map((item) => {
      const canSend = ['scheduled', 'overdue', 'failed'].includes(item.status) && this.app.hasFeature?.('crm.followup.send');
      const canCancel = ['scheduled', 'overdue', 'failed'].includes(item.status);
      const when = this.escapeHtml(this.formatDate(item.scheduledAt));
      const message = this.escapeHtml(item.message || item.messageTemplate || '');
      const actions = `<div class="crm-followup-item-actions">
        ${canSend ? `<button type="button" class="btn btn-sm btn-primary" data-followup-send="${this.escapeHtml(item.id)}"><i class="fas fa-paper-plane"></i> Enviar agora</button>` : ''}
        ${canCancel ? `<button type="button" class="btn btn-sm btn-secondary" data-followup-reschedule="${this.escapeHtml(item.id)}"><i class="fas fa-calendar-pen"></i> Reagendar</button><button type="button" class="btn btn-sm btn-danger" data-followup-cancel="${this.escapeHtml(item.id)}">Cancelar</button>` : ''}
        ${item.status === 'cancelled' || item.status === 'sent' || String(item.status || '').startsWith('blocked_') ? `<button type="button" class="btn btn-sm btn-secondary" data-followup-delete="${this.escapeHtml(item.id)}"><i class="fas fa-trash"></i></button>` : ''}
      </div>`;
      return `<article class="crm-followup-item">
        <div class="crm-followup-item-top"><strong>${item.stepCount > 1 ? `Etapa ${Number(item.stepIndex) || 1}/${Number(item.stepCount) || 1}` : 'Mensagem programada'}</strong><span class="crm-followup-status status-${this.escapeHtml(item.status)}">${this.escapeHtml(statusLabels[item.status] || item.status)}</span></div>
        <time>${when}</time><p>${message}</p>${item.lastError ? `<small class="crm-followup-warning">${this.escapeHtml(item.lastError)}</small>` : ''}${actions}
      </article>`;
    }).join('') : '<div class="crm-history-empty"><i class="fas fa-calendar-check"></i><strong>Nenhum follow-up programado</strong><span>Crie um agendamento acima para não deixar oportunidades sem retorno.</span></div>';
    container.querySelectorAll('[data-followup-send]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      const sent = await this.app.api.sendFollowupNow(button.dataset.followupSend);
      this.app.showToast(sent?.success ? 'Follow-up enviado pelo WhatsApp Web.' : (sent?.error || 'Não foi possível enviar.'), sent?.success ? 'success' : 'warning', 6000);
      await this.loadFollowups(modal, lead);
      try { await this.app.views.crm?.loadLeads?.(); } catch {}
    }));
    container.querySelectorAll('[data-followup-cancel]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Cancelar este follow-up?')) return;
      const cancelled = await this.app.api.cancelFollowup(button.dataset.followupCancel);
      this.app.showToast(cancelled?.success ? 'Follow-up cancelado.' : (cancelled?.error || 'Não foi possível cancelar.'), cancelled?.success ? 'success' : 'error');
      await this.loadFollowups(modal, lead);
    }));
    container.querySelectorAll('[data-followup-reschedule]').forEach((button) => button.addEventListener('click', async () => {
      const local = prompt('Informe a nova data e hora no formato AAAA-MM-DDTHH:mm (horário local):');
      if (!local) return;
      const timestamp = new Date(local);
      if (!Number.isFinite(timestamp.getTime())) { this.app.showToast('Data e hora inválidas.', 'warning'); return; }
      const updated = await this.app.api.rescheduleFollowup(button.dataset.followupReschedule, timestamp.toISOString());
      this.app.showToast(updated?.success ? 'Follow-up reagendado.' : (updated?.error || 'Não foi possível reagendar.'), updated?.success ? 'success' : 'error');
      await this.loadFollowups(modal, lead);
    }));
    container.querySelectorAll('[data-followup-delete]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Excluir este registro do histórico de follow-ups?')) return;
      const deleted = await this.app.api.deleteFollowup(button.dataset.followupDelete);
      this.app.showToast(deleted?.success ? 'Registro excluído.' : (deleted?.error || 'Não foi possível excluir.'), deleted?.success ? 'success' : 'error');
      await this.loadFollowups(modal, lead);
    }));
    const templateSelect = modal.querySelector('#crm-followup-template');
    if (templateSelect && this.followupTemplates.length) {
      templateSelect.innerHTML = '<option value="">Escolha um modelo (opcional)</option>' + this.followupTemplates.map((item) => `<option value="${this.escapeHtml(item.id)}">${this.escapeHtml(item.name)}</option>`).join('');
    }
  }

  collectFollowupSteps(modal) {
    const rows = [...modal.querySelectorAll('[data-followup-step]')];
    return rows.map((row) => {
      const value = Math.max(1, Number(row.querySelector('[data-step-value]')?.value) || 1);
      const unit = row.querySelector('[data-step-unit]')?.value || 'days';
      const multiplier = unit === 'minutes' ? 1 : unit === 'hours' ? 60 : 1440;
      const custom = String(row.querySelector('[data-step-datetime]')?.value || '').trim();
      const messageTemplate = String(row.querySelector('[data-step-message]')?.value || '').trim();
      return custom
        ? { scheduledAt: new Date(custom).toISOString(), messageTemplate }
        : { delayMinutes: value * multiplier, messageTemplate };
    });
  }

  async scheduleFollowups(modal, lead) {
    if (!this.app.hasFeature?.('crm.followup.manage')) { this.app.showAccessPrompt?.('crm.followup.manage'); return; }
    if (!this.app.hasFeature?.('crm.followup.send')) { this.app.showAccessPrompt?.('crm.followup.send'); return; }
    const steps = this.collectFollowupSteps(modal);
    if (!steps.length || steps.length > 10) { this.app.showToast('Adicione entre 1 e 10 etapas.', 'warning'); return; }
    if (steps.some((step) => !step.messageTemplate)) { this.app.showToast('Preencha a mensagem de todas as etapas.', 'warning'); return; }
    const button = modal.querySelector('#crm-followup-schedule');
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Agendando...'; }
    const options = {
      consentConfirmed: modal.querySelector('#crm-followup-consent')?.checked === true,
      cancelOnReply: modal.querySelector('#crm-followup-cancel-on-reply')?.checked !== false,
    };
    const leadId = lead.id || lead.placeId || lead.phone;
    const result = steps.length > 1
      ? await this.app.api.scheduleFollowupSequence(leadId, steps, options)
      : await this.app.api.scheduleFollowup(leadId, steps[0], options);
    if (!result?.success) {
      if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-calendar-check"></i> Agendar follow-up'; }
      this.app.showToast(result?.error || 'Não foi possível programar o follow-up.', 'error', 7000);
      return;
    }
    this.app.showToast(`${result.data?.followups?.length || steps.length} follow-up(s) programado(s).`, 'success', 5000);
    const latest = await this.app.api.getSavedLeads();
    const updatedLead = latest?.data?.find((item) => String(item.id || item.placeId || item.phone) === String(leadId));
    if (updatedLead) Object.assign(lead, updatedLead);
    modal.remove();
    this.show(lead);
    try { await this.app.views.crm?.loadLeads?.(); } catch {}
  }

  bindCalendarAutomation() {
    if (!this.app.hasFeature?.('google.calendar.automation')) return;
    document.getElementById('calendar-auto-trigger-type')?.addEventListener('change', () => this.toggleCalendarAutomationFields());
    document.getElementById('calendar-auto-action')?.addEventListener('change', () => this.toggleCalendarAutomationFields());
    document.getElementById('calendar-auto-save')?.addEventListener('click', () => this.saveCalendarAutomationRule());
    document.getElementById('calendar-auto-refresh')?.addEventListener('click', () => this.loadCalendarAutomation());
    document.getElementById('calendar-auto-reset')?.addEventListener('click', () => this.resetCalendarAutomationForm());
    this.loadCalendarAutomation();
  }

  toggleCalendarAutomationFields() {
    const trigger = document.getElementById('calendar-auto-trigger-type')?.value || 'stage';
    const action = document.getElementById('calendar-auto-action')?.value || 'create_relative_event';
    const show = (id, visible) => { const el = document.getElementById(id); if (el) el.style.display = visible ? '' : 'none'; };
    show('calendar-auto-stage-wrap', trigger === 'stage');
    show('calendar-auto-tag-wrap', trigger === 'tag');
    show('calendar-auto-offset-wrap', action === 'create_relative_event');
    show('calendar-auto-time-wrap', action === 'create_relative_event');
    show('calendar-auto-date-field-wrap', action === 'create_event_from_lead');
    show('calendar-auto-time-field-wrap', action === 'create_event_from_lead');
    const approval = document.getElementById('calendar-auto-approval');
    if (approval) {
      if (action === 'request_booking') { approval.checked = true; approval.disabled = true; }
      else approval.disabled = false;
    }
  }

  async loadCalendarAutomation() {
    const [rulesResult, tasksResult, stagesResult, leadsResult] = await Promise.all([
      this.app.api.getCalendarAutomationRules(),
      this.app.api.getCalendarAutomationTasks(),
      this.app.api.getStages(),
      this.app.api.getSavedLeads(),
    ]);
    this.calendarAutomationRules = rulesResult?.data || [];
    this.calendarAutomationTasks = tasksResult?.data || [];
    this.calendarAutomationStages = stagesResult?.data || [];
    const stageSelect = document.getElementById('calendar-auto-stage-value');
    if (stageSelect) stageSelect.innerHTML = this.calendarAutomationStages.map((stage) => `<option value="${this.escapeHtml(stage.id)}">${this.escapeHtml(stage.title || stage.name || stage.id)}</option>`).join('') || '<option value="">Nenhuma etapa disponível</option>';
    const tagList = document.getElementById('calendar-auto-tags');
    if (tagList) {
      const tags = [...new Set((leadsResult?.data || []).flatMap((lead) => Array.isArray(lead.tags) ? lead.tags : []).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b),'pt-BR'));
      tagList.innerHTML = tags.map((tag) => `<option value="${this.escapeHtml(tag)}"></option>`).join('');
    }
    this.renderCalendarAutomationRules();
    this.renderCalendarAutomationTasks();
    this.toggleCalendarAutomationFields();
  }

  async saveCalendarAutomationRule() {
    const value = (id) => document.getElementById(id)?.value || '';
    const triggerType = value('calendar-auto-trigger-type');
    const actionType = value('calendar-auto-action');
    const triggerValue = triggerType === 'stage' ? value('calendar-auto-stage-value') : value('calendar-auto-tag-value').trim();
    if (!triggerValue) { this.app.showToast('Escolha uma etapa ou informe uma etiqueta.', 'warning'); return; }
    const existing = this.calendarAutomationRules || [];
    const editId = this.editingCalendarAutomationId || '';
    const rule = {
      id: editId || `calrule_${Date.now().toString(36)}`,
      name: value('calendar-auto-name').trim() || `Automação: ${triggerValue}`,
      enabled: true,
      trigger: { type: triggerType, value: triggerValue },
      action: {
        type: actionType,
        offsetValue: Number(value('calendar-auto-offset') || 2),
        offsetUnit: value('calendar-auto-offset-unit') || 'days',
        preferredTime: value('calendar-auto-time') || '10:00',
        durationMinutes: Number(value('calendar-auto-duration') || 30),
        summaryTemplate: value('calendar-auto-summary') || 'Retorno comercial — {{nome}}',
        noteTemplate: value('calendar-auto-note'),
        requireApproval: actionType === 'request_booking' || document.getElementById('calendar-auto-approval')?.checked === true,
        sendWhatsAppConfirmation: document.getElementById('calendar-auto-confirmation')?.checked === true,
        dateField: value('calendar-auto-date-field') || 'appointmentDate',
        timeField: value('calendar-auto-time-field') || 'appointmentTime',
      },
      createdAt: existing.find((item) => item.id === editId)?.createdAt || new Date().toISOString(),
    };
    const next = editId ? existing.map((item) => item.id === editId ? rule : item) : [...existing, rule];
    const button = document.getElementById('calendar-auto-save');
    if (button) { button.disabled = true; button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }
    const result = await this.app.api.saveCalendarAutomationRules(next);
    if (button) { button.disabled = false; button.innerHTML = '<i class="fas fa-save"></i> Salvar regra'; }
    if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível salvar a regra.', 'error', 6000); return; }
    this.calendarAutomationRules = result.data || next;
    this.resetCalendarAutomationForm();
    this.renderCalendarAutomationRules();
    this.app.showToast(editId ? 'Regra atualizada.' : 'Regra criada.', 'success');
  }

  resetCalendarAutomationForm() {
    this.editingCalendarAutomationId = '';
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
    set('calendar-auto-name', '');
    set('calendar-auto-trigger-type', 'stage');
    set('calendar-auto-tag-value', '');
    set('calendar-auto-action', 'create_relative_event');
    set('calendar-auto-offset', '2');
    set('calendar-auto-offset-unit', 'days');
    set('calendar-auto-time', '10:00');
    set('calendar-auto-date-field', 'appointmentDate');
    set('calendar-auto-time-field', 'appointmentTime');
    set('calendar-auto-duration', '30');
    set('calendar-auto-summary', 'Retorno comercial — {{nome}}');
    set('calendar-auto-note', '');
    const approval = document.getElementById('calendar-auto-approval'); if (approval) { approval.checked = false; approval.disabled = false; }
    const confirmation = document.getElementById('calendar-auto-confirmation'); if (confirmation) confirmation.checked = false;
    const save = document.getElementById('calendar-auto-save'); if (save) save.innerHTML = '<i class="fas fa-plus"></i> Salvar regra';
    const reset = document.getElementById('calendar-auto-reset'); if (reset) reset.style.display = 'none';
    this.toggleCalendarAutomationFields();
  }

  editCalendarAutomationRule(ruleId) {
    const rule = (this.calendarAutomationRules || []).find((item) => item.id === ruleId);
    if (!rule) return;
    this.editingCalendarAutomationId = rule.id;
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value ?? ''; };
    set('calendar-auto-name', rule.name);
    set('calendar-auto-trigger-type', rule.trigger.type);
    set('calendar-auto-stage-value', rule.trigger.type === 'stage' ? rule.trigger.value : (this.calendarAutomationStages?.[0]?.id || ''));
    set('calendar-auto-tag-value', rule.trigger.type === 'tag' ? rule.trigger.value : '');
    set('calendar-auto-action', rule.action.type);
    set('calendar-auto-offset', rule.action.offsetValue);
    set('calendar-auto-offset-unit', rule.action.offsetUnit);
    set('calendar-auto-time', rule.action.preferredTime);
    set('calendar-auto-date-field', rule.action.dateField);
    set('calendar-auto-time-field', rule.action.timeField);
    set('calendar-auto-duration', rule.action.durationMinutes);
    set('calendar-auto-summary', rule.action.summaryTemplate);
    set('calendar-auto-note', rule.action.noteTemplate);
    const approval = document.getElementById('calendar-auto-approval'); if (approval) approval.checked = rule.action.requireApproval === true;
    const confirmation = document.getElementById('calendar-auto-confirmation'); if (confirmation) confirmation.checked = rule.action.sendWhatsAppConfirmation === true;
    const save = document.getElementById('calendar-auto-save'); if (save) save.innerHTML = '<i class="fas fa-save"></i> Atualizar regra';
    const reset = document.getElementById('calendar-auto-reset'); if (reset) reset.style.display = '';
    this.toggleCalendarAutomationFields();
  }

  async persistCalendarAutomationRules(next, message) {
    const result = await this.app.api.saveCalendarAutomationRules(next);
    if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível atualizar as regras.', 'error'); return false; }
    this.calendarAutomationRules = result.data || next;
    this.renderCalendarAutomationRules();
    if (message) this.app.showToast(message, 'success');
    return true;
  }

  renderCalendarAutomationRules() {
    const el = document.getElementById('calendar-automation-rules');
    if (!el) return;
    const rules = this.calendarAutomationRules || [];
    if (!rules.length) { el.innerHTML = '<div class="crm-history-empty">Nenhuma regra cadastrada. Crie uma regra acima para automatizar sua agenda.</div>'; return; }
    const stageName = (id) => this.calendarAutomationStages?.find((stage) => String(stage.id) === String(id))?.title || id;
    const actionName = { request_booking: 'Solicitar agendamento', create_relative_event: 'Criar compromisso após intervalo', create_event_from_lead: 'Criar compromisso com data do card' };
    el.innerHTML = rules.map((rule) => {
      const triggerLabel = rule.trigger.type === 'stage' ? `Etapa: ${stageName(rule.trigger.value)}` : `Etiqueta: ${rule.trigger.value}`;
      return `<article class="followup-row" style="margin-top:8px"><div class="followup-row-main"><div class="followup-row-top"><strong>${this.escapeHtml(rule.name)}</strong><span class="crm-followup-status ${rule.enabled ? 'status-sent' : 'status-cancelled'}">${rule.enabled ? 'Ativa' : 'Pausada'}</span></div><small>${this.escapeHtml(triggerLabel)} · ${this.escapeHtml(actionName[rule.action.type] || rule.action.type)}</small><p>${rule.action.type === 'create_relative_event' ? `Após ${Number(rule.action.offsetValue)} ${rule.action.offsetUnit === 'hours' ? 'hora(s)' : 'dia(s)'}, às ${this.escapeHtml(rule.action.preferredTime)}.` : rule.action.type === 'create_event_from_lead' ? `Campos: ${this.escapeHtml(rule.action.dateField)} / ${this.escapeHtml(rule.action.timeField)}.` : 'O vendedor será solicitado a escolher o horário.'}${rule.action.requireApproval ? ' Exige aprovação.' : ''}</p></div><div class="followup-row-actions"><label class="toggle" title="Ativar ou pausar"><input type="checkbox" data-calendar-rule-toggle="${this.escapeHtml(rule.id)}" ${rule.enabled ? 'checked' : ''}><span class="toggle-slider"></span></label><button type="button" class="btn btn-sm btn-secondary" data-calendar-rule-edit="${this.escapeHtml(rule.id)}">Editar</button><button type="button" class="btn btn-sm btn-danger" data-calendar-rule-delete="${this.escapeHtml(rule.id)}">Excluir</button></div></article>`;
    }).join('');
    el.querySelectorAll('[data-calendar-rule-toggle]').forEach((input) => input.addEventListener('change', async () => {
      const next = this.calendarAutomationRules.map((rule) => rule.id === input.dataset.calendarRuleToggle ? { ...rule, enabled: input.checked } : rule);
      if (!await this.persistCalendarAutomationRules(next, input.checked ? 'Automação ativada.' : 'Automação pausada.')) input.checked = !input.checked;
    }));
    el.querySelectorAll('[data-calendar-rule-edit]').forEach((button) => button.addEventListener('click', () => this.editCalendarAutomationRule(button.dataset.calendarRuleEdit)));
    el.querySelectorAll('[data-calendar-rule-delete]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('Excluir esta regra de automação? Os eventos já criados na agenda não serão removidos.')) return;
      const next = this.calendarAutomationRules.filter((rule) => rule.id !== button.dataset.calendarRuleDelete);
      await this.persistCalendarAutomationRules(next, 'Regra excluída. Eventos já criados foram preservados.');
    }));
  }

  renderCalendarAutomationTasks() {
    const el = document.getElementById('calendar-automation-tasks');
    if (!el) return;
    const tasks = (this.calendarAutomationTasks || []).filter((task) => task.status === 'needs_review');
    if (!tasks.length) { el.innerHTML = '<div class="crm-history-empty">Nenhuma ação aguardando revisão.</div>'; return; }
    el.innerHTML = tasks.map((task) => `<article class="followup-row" style="margin-top:8px"><div class="followup-row-main"><strong>${this.escapeHtml(task.title)}</strong><small>${this.escapeHtml(task.leadName)} · ${this.escapeHtml(new Date(task.createdAt).toLocaleString('pt-BR'))}</small><p>${this.escapeHtml(task.reason)}${task.proposedStart ? `<br><strong>Horário sugerido:</strong> ${this.escapeHtml(new Date(task.proposedStart).toLocaleString('pt-BR'))}` : ''}</p></div><div class="followup-row-actions"><button type="button" class="btn btn-sm btn-primary" data-calendar-task-open="${this.escapeHtml(task.leadId)}">Abrir lead</button><button type="button" class="btn btn-sm btn-secondary" data-calendar-task-dismiss="${this.escapeHtml(task.id)}">Dispensar</button></div></article>`).join('');
    el.querySelectorAll('[data-calendar-task-open]').forEach((button) => button.addEventListener('click', async () => {
      const result = await this.app.api.getSavedLeads();
      const lead = result?.data?.find((item) => String(item.id || item.placeId || item.phone) === button.dataset.calendarTaskOpen);
      if (lead) this.app.leadModal.show(lead);
      else this.app.showToast('Lead não encontrado. Atualize o CRM.', 'warning');
    }));
    el.querySelectorAll('[data-calendar-task-dismiss]').forEach((button) => button.addEventListener('click', async () => {
      const result = await this.app.api.dismissCalendarAutomationTask(button.dataset.calendarTaskDismiss);
      if (!result?.success) { this.app.showToast(result?.error || 'Não foi possível dispensar.', 'error'); return; }
      this.calendarAutomationTasks = this.calendarAutomationTasks.map((task) => task.id === button.dataset.calendarTaskDismiss ? { ...task, status: 'dismissed' } : task);
      this.renderCalendarAutomationTasks();
      this.app.showToast('Pendência dispensada.', 'success');
    }));
  }

  switchTab(tab) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === `tab-${tab}`));
  }

  async validateLicense() {
    const key = document.getElementById("license-key").value.trim();
    if (!key) { this.app.showToast("Digite uma chave", "warning"); return; }
    try {
      this.app.showToast("Validando...", "info");
      const res = await this.app.api.validateLicense(key);
      if (res.success) {
        const status = res.data || (await this.app.api.getLicenseStatus())?.data || {};
        if (status.licensed && status.entitlementsConfigured) {
          this.app.showToast("Licença validada e permissões carregadas!", "success");
        } else {
          this.app.showToast("Licença validada, mas o painel precisa configurar as permissões dos recursos.", "warning", 8000);
        }
        await this.app.refreshLicense();
        this.updateLicenseStatus();
      } else { this.app.showToast(res.error || "Chave inválida", "error"); }
    } catch (error) { this.app.showToast("Erro: " + error.message, "error"); }
  }

  async saveWebhook() {
    const headersText = document.getElementById("webhook-headers").value.trim();
    let headers = {};
    try { headers = headersText ? JSON.parse(headersText) : {}; } catch { this.app.showToast("Headers JSON invalido", "error"); return; }
    const config = {
      webhookUrl: document.getElementById("webhook-url").value.trim(),
      webhookMethod: document.getElementById("webhook-method").value,
      webhookContentType: document.getElementById("webhook-content-type").value,
      webhookHeaders: headers,
      webhookApiKey: document.getElementById("webhook-api-key").value.trim(),
    };
    const result = await this.app.api.saveWebhookSettings(config);
    if (!result.success) { this.app.showToast(result.error || "Não foi possível salvar o webhook.", "error"); return; }
    Object.assign(this.settings, config);
    this.app.showToast("Webhook salvo!", "success");
  }

  async testWebhook() {
    const url = document.getElementById("webhook-url").value.trim();
    if (!url) { this.app.showToast("Configure a URL primeiro", "warning"); return; }
    try {
      this.app.showToast("Testando...", "info");
      const res = await this.app.api.testWebhook(url);
      const container = document.getElementById("webhook-test-result");
      if (res.success) {
        container.innerHTML = `<div class="status-badge success"><i class="fas fa-check-circle"></i> Conexao OK - Status: ${res.data?.status}</div>`;
        this.app.showToast("Webhook funcionando!", "success");
      } else {
        container.innerHTML = `<div class="status-badge error"><i class="fas fa-times-circle"></i> Erro: ${this.escapeHtml(res.error || "Falha no teste")}</div>`;
        this.app.showToast("Falha no teste", "error");
      }
    } catch (error) {
      document.getElementById("webhook-test-result").innerHTML = `<div class="status-badge error"><i class="fas fa-times-circle"></i> Erro: ${this.escapeHtml(error.message || "Erro inesperado")}</div>`;
      this.app.showToast("Erro: " + error.message, "error");
    }
  }

  async saveDelays() {
    this.settings.delayMsgMin = parseInt(document.getElementById("delay-msg-min").value) || 2000;
    this.settings.delayMsgMax = parseInt(document.getElementById("delay-msg-max").value) || 5000;
    this.settings.delayContactMin = parseInt(document.getElementById("delay-contact-min").value) || 5000;
    this.settings.delayContactMax = parseInt(document.getElementById("delay-contact-max").value) || 15000;
    this.settings.delayErrorMin = parseInt(document.getElementById("delay-error-min").value) || 30000;
    this.settings.delayErrorMax = parseInt(document.getElementById("delay-error-max").value) || 60000;
    if (await this.saveSettings()) this.app.showToast("Delays salvos!", "success");
  }

  addPreset() {
    const presets = this.settings.spintaxPresets || [];
    presets.push({ name: "Novo Preset", template: "{Opcao 1|Opcao 2|Opcao 3}" });
    this.settings.spintaxPresets = presets;
    this.saveSettings();
    this.renderSpintaxPresets();
  }

  updatePreset(index, field, value) {
    const presets = this.settings.spintaxPresets || [];
    if (presets[index]) { presets[index][field] = value; this.saveSettings(); }
  }

  deletePreset(index) {
    const presets = this.settings.spintaxPresets || [];
    presets.splice(index, 1);
    this.settings.spintaxPresets = presets;
    this.saveSettings();
    this.renderSpintaxPresets();
  }

  async saveSettings() {
    try {
      const result = await this.app.api.saveSettings(this.settings);
      if (!result?.success) {
        if (!["LICENSE_REQUIRED", "FEATURE_NOT_INCLUDED", "LICENSE_PERMISSIONS_MISSING", "FEATURE_NOT_CONFIGURED"].includes(result?.code)) {
          this.app.showToast(result?.error || "Não foi possível salvar as configurações.", "error");
        }
        return false;
      }
      return true;
    } catch (error) {
      this.app.showToast("Erro ao salvar: " + error.message, "error");
      return false;
    }
  }

  exportBackup() {
    const data = { settings: this.settings, leads: this.app.state.get("leads") || [], campaigns: this.app.state.get("campaigns") || [] };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `i9hub-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.app.showToast("Backup exportado!", "success");
  }

  importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.settings) {
          const previousSettings = this.settings;
          this.settings = { ...this.settings, ...data.settings };
          if (!(await this.saveSettings())) { this.settings = previousSettings; return; }
          this.populateForm();
        }
        if (data.leads) {
          const leadResult = await this.app.api.saveLeads(data.leads, "backup_import");
          if (!leadResult?.success) {
            if (!["LICENSE_REQUIRED", "FEATURE_NOT_INCLUDED", "LICENSE_PERMISSIONS_MISSING", "FEATURE_NOT_CONFIGURED"].includes(leadResult?.code)) this.app.showToast(leadResult?.error || "Não foi possível importar os leads.", "error");
            return;
          }
        }
        this.app.showToast("Backup importado com sucesso!", "success");
      } catch (error) { this.app.showToast("Erro ao importar: " + error.message, "error"); }
    };
    reader.readAsText(file);
    document.getElementById("backup-file").value = "";
  }

  async clearStorage() {
    if (!confirm("Isso ira remover TODOS os dados (leads, campanhas, configuracoes). Tem certeza?")) return;
    try {
      const result = await this.app.api.clearAllData();
      if (!result?.success) {
        if (!["LICENSE_REQUIRED", "FEATURE_NOT_INCLUDED", "LICENSE_PERMISSIONS_MISSING", "FEATURE_NOT_CONFIGURED"].includes(result?.code)) this.app.showToast(result?.error || "Não foi possível limpar os dados.", "error");
        return;
      }
      this.settings = {};
      this.populateForm();
      this.app.showToast("Todos os dados foram limpos", "success");
    } catch (error) { this.app.showToast("Erro: " + error.message, "error"); }
  }

  escapeHtml(text) { const div = document.createElement("div"); div.textContent = text; return div.innerHTML.replace(/"/g, "&quot;").replace(/\'/g, "&#39;"); }
}

