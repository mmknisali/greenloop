const API = './api';

async function _req(path, { authRequired = false, ...opts } = {}) {
    let res;
    try {
        res = await fetch(API + path, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            ...opts,
        });
    } catch (_) {
        return { ok: false, msg: 'Bağlantı hatası.' };
    }
    if (res.status === 401 && authRequired) {
        if (!window.location.pathname.endsWith('/login.html')) window.location.replace('login.html');
        return { ok: false, msg: 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.' };
    }
    const payload = await res.json().catch(() => null);
    if (!payload || typeof payload.ok !== 'boolean') return { ok: false, msg: 'Bağlantı hatası.' };
    if (res.ok && payload?.ok === true) return payload;
    const msg = payload?.ok === false && typeof payload.msg === 'string' && payload.msg;
    return { ok: false, msg: msg || 'Bir hata oluştu. Lütfen tekrar deneyin.' };
}
const _get  = (p, authRequired)    => _req(p, { method: 'GET', authRequired });
const _post = (p, d, authRequired) => _req(p, { method: 'POST', authRequired, body: JSON.stringify(d) });
const _del  = (p, authRequired)    => _req(p, { method: 'DELETE', authRequired });

function esc(value) {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value ?? '').replace(/[&<>"']/g, c => entities[c]);
}
const escapeHtml = esc;

function safeHttpUrl(value) {
    if (typeof value !== 'string') return '';
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch (_) {
        return '';
    }
}

function companyDetailUrl(id) {
    return 'company-detail.html?' + new URLSearchParams({ id });
}

const Auth = {
    getCurrent: async () => {
        const r = await _get('/auth.php?action=me');
        return r.ok ? r.data : null;
    },
    register: d => _post('/auth.php?action=register', d),
    loginWithCredentials: (email, password) => _post('/auth.php?action=login', { email, password }),
    logout: () => _post('/auth.php?action=logout', {}, true),
};

const Companies = {
    getAll:   async () => { const r = await _get('/companies.php?action=all'); return Array.isArray(r.data) ? r.data : []; },
    getById:  async id => {
        if (!id) return null;
        const r = await _get(`/companies.php?action=get&id=${encodeURIComponent(id)}`);
        return r.ok ? r.data : null;
    },
    getByUser:async () => { const r = await _get('/companies.php?action=mine', true); return Array.isArray(r.data) ? r.data : []; },
    add:      d  => _post('/companies.php?action=add', d, true),
    delete:   id => _del(`/companies.php?action=delete&id=${encodeURIComponent(id)}`, true),
};

const Matches = { network: () => _get('/matches.php?action=network') };

const Messages = {
    send:                  (d, signedIn = false) => _post('/messages.php?action=send', d, signedIn),
    getThreadsForCompany:  async () => { const r = await _get('/messages.php?action=threads', true); return Array.isArray(r.data) ? r.data : []; },
    getSentThreads:        async () => { const r = await _get('/messages.php?action=sent', true);    return Array.isArray(r.data) ? r.data : []; },
    getThreadMsgs:         async id => {
        const r = await _get(`/messages.php?action=thread&id=${encodeURIComponent(id)}`, true);
        return Array.isArray(r.data) ? r.data : null;
    },
    markRead:              ids => _post('/messages.php?action=read', { ids }, true),
    reply:                 d   => _post('/messages.php?action=reply', d, true),
    deleteThread:          d   => _post('/messages.php?action=delete_thread', d, true),
    pollNew:               (sinceId, companyId) => {
        const params = new URLSearchParams({ action: 'poll', since_id: sinceId });
        if (companyId) params.set('company_id', companyId);
        return _get(`/messages.php?${params}`, true);
    },
};

function startMessagePolling(onMessages, companyId) {
    let lastId = 0, timer, busy = false, stopped = false;
    async function poll() {
        if (busy || stopped || document.hidden) return;
        busy = true;
        try {
            const res = await Messages.pollNew(lastId, companyId);
            if (stopped || document.hidden || !res.ok) return;
            const data = res.data;
            if (!Array.isArray(data?.messages) || data.lastId == null) return;
            lastId = data.lastId;
            if (data.messages.length) await onMessages(data.messages);
        } finally {
            busy = false;
        }
    }
    function syncVisibility() {
        clearInterval(timer);
        if (!document.hidden) {
            poll();
            timer = setInterval(poll, 10000);
        }
    }
    document.addEventListener('visibilitychange', syncVisibility);
    syncVisibility();
    return () => {
        stopped = true;
        clearInterval(timer);
        document.removeEventListener('visibilitychange', syncVisibility);
    };
}
