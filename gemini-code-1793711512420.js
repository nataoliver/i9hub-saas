async sendMessage(type, payload = {}) {
    const token = localStorage.getItem('i9hub_jwt');
    if (!token) {
      window.location.href = '/login.html';
      return { success: false, error: 'Redirecionando para login...' };
    }
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    const overrideTenant = sessionStorage.getItem('i9hub_tenant_override');
    if (overrideTenant) headers['x-tenant-override'] = overrideTenant;

    try {
      const res = await fetch('/api/rpc', {
        method: 'POST',
        headers,
        body: JSON.stringify({ type, payload })
      });
      if (res.status === 401) {
        localStorage.removeItem('i9hub_jwt');
        window.location.href = '/login.html';
        return { success: false, error: 'Sessão expirada.' };
      }
      return await res.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  openCrmLeadChat(lead) {
    const phone = String(lead?.phone || '').replace(/\D/g, '');
    if (phone.length >= 10) {
      window.open(`https://web.whatsapp.com/send/?phone=${phone}&text=`, '_blank', 'noopener,noreferrer');
      return Promise.resolve({ success: true });
    }
    return Promise.resolve({ success: false, error: 'Telefone inválido.' });
  }