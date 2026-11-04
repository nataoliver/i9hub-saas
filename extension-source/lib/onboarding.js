/**
 * Fluxo de solicitação de conta gratuita do i9Hub.
 * O WhatsApp é apenas o canal de solicitação; a licença continua sendo emitida
 * e autorizada pelo backend administrativo.
 */
export const WHATSAPP_SUPPORT_NUMBER = '5511954721939';

export function buildWhatsAppUrl(kind = 'free-account', featureName = '') {
  let message;
  if (kind === 'license-support') {
    message = 'Olá! Vim pela extensão i9Hub. Já tenho uma licença e preciso de ajuda para conferir/liberar as funcionalidades da minha conta. Origem: Extensão i9Hub.';
  } else if (kind === 'feature-access' && featureName) {
    message = `Olá! Vim pela extensão i9Hub. Gostaria de saber como liberar a funcionalidade "${String(featureName).slice(0, 100)}" na minha licença. Origem: Extensão i9Hub.`;
  } else {
    message = 'Olá! Vim pela extensão i9Hub e gostaria de criar minha conta gratuita para começar a utilizar as funcionalidades. Poderiam me orientar sobre o cadastro e a ativação da minha licença gratuita? Origem: Extensão i9Hub.';
  }
  return `https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(message)}`;
}
