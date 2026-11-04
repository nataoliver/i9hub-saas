import { buildWhatsAppUrl } from '../../lib/onboarding.js';

/** Modal de conta/licença: a autorização é emitida exclusivamente pelo painel administrativo. */
export class LicenseModal {
  constructor(app) {
    this.app = app;
    this.el = null;
    document.addEventListener('i9:license-required', (e) => this.show(e.detail));
  }

  show(info = {}) {
    if (this.el) return;
    const code = String(info.code || 'LICENSE_REQUIRED');
    const hasLicense = code === 'FEATURE_NOT_INCLUDED' || code === 'LICENSE_PERMISSIONS_MISSING' || code === 'FEATURE_NOT_CONFIGURED';
    const title = code === 'FEATURE_NOT_INCLUDED'
      ? 'Funcionalidade não liberada'
      : code === 'LICENSE_PERMISSIONS_MISSING' || code === 'FEATURE_NOT_CONFIGURED'
        ? 'Permissões da licença precisam de atenção'
        : 'Ative sua conta gratuita';
    const headline = code === 'FEATURE_NOT_INCLUDED'
      ? `O recurso "${this.escapeHtml(info.featureName || 'solicitado')}" não está incluído na sua licença.`
      : code === 'LICENSE_PERMISSIONS_MISSING' || code === 'FEATURE_NOT_CONFIGURED'
        ? 'Sua licença precisa ter as permissões configuradas no painel administrativo.'
        : 'Para utilizar as funções do i9Hub, você precisa de uma licença emitida pelo painel administrativo.';
    const description = hasLicense
      ? 'Fale com o suporte para conferir as permissões da sua conta. A extensão não libera recursos por conta própria.'
      : 'Clique abaixo para solicitar sua conta gratuita. Depois que o atendimento liberar sua licença, cole a chave recebida no campo abaixo.';
    const whatsappUrl = info.whatsappUrl || buildWhatsAppUrl(hasLicense ? 'license-support' : 'free-account', info.featureName || '');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.id = 'licensing-modal';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="lic-title" style="max-width:440px">
        <div class="modal-header">
          <h3 class="modal-title" id="lic-title">${title}</h3>
          <button class="modal-close" id="lic-close" aria-label="Fechar">&times;</button>
        </div>
        <div class="modal-body" style="text-align:center">
          <div style="font-size:42px;line-height:1;margin-bottom:12px">${hasLicense ? '🔑' : '👋'}</div>
          <p style="margin-bottom:8px"><strong>${headline}</strong></p>
          <p style="margin-bottom:16px;opacity:.8">${description}</p>
          <a class="btn btn-primary" id="lic-wa" href="${this.escapeAttribute(whatsappUrl)}" target="_blank" rel="noopener noreferrer"
             style="display:block;background:#25d366;border-color:#25d366;color:#fff;text-decoration:none;padding:12px;font-weight:600;margin-bottom:8px">
            ${hasLicense ? 'Falar com suporte no WhatsApp' : 'Quero minha conta grátis'}
          </a>
          <p style="font-size:12px;opacity:.7;margin-bottom:16px">A licença e as funções liberadas são controladas pelo painel administrativo.</p>
          <hr style="border:none;border-top:1px solid var(--border,#444);margin:12px 0">
          <p style="font-size:13px;margin-bottom:8px">Já recebeu uma chave de licença?</p>
          <div style="display:flex;gap:6px">
            <input class="form-input" id="lic-key" type="text" placeholder="Cole aqui a chave recebida" autocomplete="off" style="flex:1">
            <button class="btn btn-secondary" id="lic-activate">Ativar</button>
          </div>
          <p id="lic-msg" style="font-size:12px;min-height:16px;margin-top:8px"></p>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    this.el = overlay;

    const close = () => { overlay.remove(); this.el = null; };
    overlay.querySelector('#lic-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#lic-activate').addEventListener('click', async () => {
      const key = overlay.querySelector('#lic-key').value.trim();
      const message = overlay.querySelector('#lic-msg');
      if (!key) { message.textContent = 'Cole a chave de licença recebida.'; message.style.color = '#e57373'; return; }
      message.textContent = 'Validando licença e permissões...'; message.style.color = '';
      const res = await this.app.api.validateLicense(key);
      if (res.success) {
        close();
        const status = res.data || (await this.app.api.getLicenseStatus())?.data;
        if (status?.licensed && status?.entitlementsConfigured) {
          this.app.showToast('Licença ativada e permissões carregadas!', 'success');
        } else {
          this.app.showToast('Licença validada, mas o painel precisa configurar as permissões dos recursos.', 'warning', 8000);
        }
        await this.app.refreshLicense();
      } else {
        message.textContent = res.error || 'Não foi possível ativar a licença.';
        message.style.color = '#e57373';
      }
    });
  }

  escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  escapeAttribute(value) { return this.escapeHtml(value); }
}
