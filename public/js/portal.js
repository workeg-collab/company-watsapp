// =========================================================================
// Power of Media - Client Dedicated Portal Controller
// =========================================================================

let portalState = {
  activeTab: 'dashboard',
  tenant: null,
  rules: [],
  contacts: [],
  conversations: [],
  activePhone: null,
  activeSenderName: null,
  stats: {}
};

document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  await checkUrlAutoLogin();
});

async function checkUrlAutoLogin() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id') || urlParams.get('tenant_id') || urlParams.get('key');
  const pin = urlParams.get('pin') || urlParams.get('key');

  if (id && pin) {
    document.getElementById('login-identifier').value = id;
    document.getElementById('login-pin').value = pin;
    await performLogin(id, pin);
    return;
  }

  // Check LocalStorage
  const savedAuth = localStorage.getItem('pom_portal_auth');
  if (savedAuth) {
    try {
      const { id, pin } = JSON.parse(savedAuth);
      await performLogin(id, pin);
    } catch (e) {
      localStorage.removeItem('pom_portal_auth');
    }
  }
}

async function handlePortalLogin(e) {
  e.preventDefault();
  const id = document.getElementById('login-identifier').value.trim();
  const pin = document.getElementById('login-pin').value.trim();
  await performLogin(id, pin);
}

async function performLogin(identifier, pin) {
  try {
    const res = await fetch('/api/portal/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, pin })
    });
    const json = await res.json();

    if (json.success) {
      localStorage.setItem('pom_portal_auth', JSON.stringify({ id: identifier, pin }));
      portalState.tenant = json.data;
      document.getElementById('portal-login-screen').classList.add('hidden');
      document.getElementById('portal-app-screen').classList.remove('hidden');
      await refreshPortalData();
      showToast(`مرحباً بك في لوحة تحكم ${json.data.name}!`, 'success');
    } else {
      showToast(json.error || 'فشل تسجيل الدخول. تحقق من البيانات.', 'error');
    }
  } catch (err) {
    showToast('خطأ في الاتصال بالخادم.', 'error');
  }
}

function portalLogout() {
  localStorage.removeItem('pom_portal_auth');
  window.location.href = '/portal';
}

async function refreshPortalData() {
  if (!portalState.tenant) return;
  const tenantId = portalState.tenant.id;

  try {
    const res = await fetch(`/api/portal/${tenantId}`);
    const json = await res.json();

    if (json.success) {
      const data = json.data;
      portalState.tenant = data.tenant;
      portalState.rules = data.rules || [];
      portalState.contacts = data.contacts || [];
      portalState.stats = data.stats || {};

      // Populate UI Header
      document.getElementById('portal-tenant-name').innerText = data.tenant.name;
      document.getElementById('portal-tenant-avatar').innerText = data.tenant.name.charAt(0).toUpperCase();
      document.getElementById('portal-phone-id').innerText = data.tenant.phone_number_id;

      // Populate Stats
      document.getElementById('pstat-messages').innerText = data.stats.totalMessages || 0;
      document.getElementById('pstat-replies').innerText = data.stats.autoRepliedCount || 0;
      document.getElementById('pstat-rules').innerText = portalState.rules.length;
      document.getElementById('pstat-contacts').innerText = portalState.contacts.length;

      // Render Sub-views
      renderPortalRecentLogs(data.recentLogs || []);
      renderPortalRules();
      renderPortalContacts();
      populatePortalSettings(data.tenant);
      loadPortalConversations();
    }
  } catch (err) {
    console.error('Failed to load portal data:', err);
  }
  lucide.createIcons();
}

function switchPortalTab(tabId) {
  portalState.activeTab = tabId;
  document.querySelectorAll('.ptab-content').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`ptab-${tabId}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.pnav-item').forEach(el => {
    el.className = 'pnav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-slate-400 hover:text-white hover:bg-slate-800/50';
  });
  const activeNav = document.getElementById(`pnav-${tabId}`);
  if (activeNav) {
    activeNav.className = 'pnav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold bg-indigo-600/15 text-indigo-400 border border-indigo-500/20';
  }

  const titles = {
    dashboard: 'نظرة عامة على نشاط شركتك',
    livechat: 'المحادثات المباشرة والرد على العملاء (Live Chat)',
    rules: 'قواعد الردود الآلية والكلمات المفتاحية',
    hours: 'مواعيد وساعات العمل الرسمية',
    contacts: 'دليل جهات الاتصال والعملاء',
    broadcast: 'إرسال حملة بث جماعية (Broadcast)',
    settings: 'إعدادات نصوص الترحيب والرد الافتراضي'
  };
  document.getElementById('portal-page-title').innerText = titles[tabId] || 'لوحة تحكم الشركة';

  if (tabId === 'livechat') {
    loadPortalConversations();
  }
  lucide.createIcons();
}

// ==========================================
// Live Chat / Conversations
// ==========================================
async function loadPortalConversations() {
  if (!portalState.tenant) return;
  const container = document.getElementById('portal-conv-list');
  if (!container) return;

  try {
    const res = await fetch(`/api/tenants/${portalState.tenant.id}/conversations`);
    const json = await res.json();

    if (json.success) {
      portalState.conversations = json.data;
      if (portalState.conversations.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-500 p-4 text-center">لا توجد محادثات مسجلة بعد.</p>`;
        return;
      }

      container.innerHTML = portalState.conversations.map(c => `
        <button onclick="openPortalChat('${c.phone}', '${escapeHtml(c.senderName)}')" class="w-full text-right p-3.5 hover:bg-slate-900/90 transition-colors flex items-start gap-3 ${portalState.activePhone === c.phone ? 'bg-indigo-950/40 border-r-2 border-indigo-500' : ''}">
          <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center font-bold text-white text-xs shrink-0">
            ${c.senderName ? c.senderName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div class="flex-1 overflow-hidden">
            <div class="flex items-center justify-between">
              <h5 class="font-bold text-xs text-white truncate">${escapeHtml(c.senderName || c.phone)}</h5>
              <span class="text-[9px] text-slate-500">${new Date(c.lastMessageAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p class="text-[11px] text-slate-400 truncate mt-0.5">${escapeHtml(c.lastMessage || 'رسالة جديدة')}</p>
          </div>
        </button>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

async function openPortalChat(phone, name) {
  portalState.activePhone = phone;
  portalState.activeSenderName = name;

  document.getElementById('portal-chat-name').innerText = name || phone;
  document.getElementById('portal-chat-phone').innerText = `+${phone}`;

  loadPortalConversations();

  const stream = document.getElementById('portal-chat-stream');
  stream.innerHTML = `<p class="text-xs text-slate-500 text-center py-6">جاري تحميل الرسائل...</p>`;

  try {
    const res = await fetch(`/api/tenants/${portalState.tenant.id}/conversations/${phone}/messages`);
    const json = await res.json();

    if (json.success) {
      const messages = json.data;
      if (messages.length === 0) {
        stream.innerHTML = `<p class="text-xs text-slate-500 text-center py-8">لا توجد رسائل سابقة.</p>`;
        return;
      }

      stream.innerHTML = messages.map(m => {
        const isOut = m.direction === 'outbound' || m.status === 'manual_sent' || m.status === 'replied';
        const time = new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const text = m.response_body || m.message_body || '';

        return `
          <div class="flex ${isOut ? 'justify-end' : 'justify-start'}">
            <div class="${isOut ? 'chat-bubble-out' : 'chat-bubble-in'} px-3.5 py-2 max-w-[80%] text-xs shadow-md">
              <p class="text-white whitespace-pre-line">${escapeHtml(text)}</p>
              <span class="text-[9px] ${isOut ? 'text-emerald-200/60 text-left' : 'text-slate-400 text-right'} block mt-1">
                ${time} ${isOut ? '✓✓' : ''}
              </span>
            </div>
          </div>
        `;
      }).join('');
      stream.scrollTop = stream.scrollHeight;
    }
  } catch (e) {
    stream.innerHTML = `<p class="text-xs text-rose-400 text-center py-4">فشل تحميل الرسائل.</p>`;
  }
}

async function sendPortalManualReply() {
  const input = document.getElementById('portal-reply-input');
  const text = input.value.trim();
  if (!text || !portalState.activePhone) {
    showToast('يرجى كتابة رسالة واختيار محادثة أولاً.', 'error');
    return;
  }

  input.value = '';

  try {
    const res = await fetch(`/api/tenants/${portalState.tenant.id}/conversations/${portalState.activePhone}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_body: text })
    });
    const json = await res.json();

    if (json.success) {
      showToast('تم إرسال الرد بنجاح عبر واتساب!', 'success');
      await openPortalChat(portalState.activePhone, portalState.activeSenderName);
    } else {
      showToast(json.error || 'فشل إرسال الرسالة', 'error');
    }
  } catch (err) {
    showToast('خطأ في إرسال الرسالة للخادم', 'error');
  }
}

// ==========================================
// Rules & Settings
// ==========================================
function renderPortalRules() {
  const container = document.getElementById('portal-rules-list');
  if (!container) return;

  if (portalState.rules.length === 0) {
    container.innerHTML = `
      <div class="glass-panel p-6 rounded-3xl text-center text-slate-500">
        <p class="text-xs">لا توجد ردود آلية مخصصة حتى الآن.</p>
        <button onclick="openNewPortalRuleModal()" class="mt-2 text-xs text-indigo-400 font-bold hover:underline">+ أضف أول كلمة مفتاحية لشركتك</button>
      </div>
    `;
    return;
  }

  container.innerHTML = portalState.rules.map(r => `
    <div class="glass-panel p-4 rounded-2xl flex items-center justify-between border border-slate-800">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-white font-mono bg-indigo-500/20 px-2 py-0.5 rounded-lg border border-indigo-500/30">${r.keyword}</span>
          <span class="text-[10px] text-slate-400">(${r.match_type})</span>
        </div>
        <p class="text-xs text-slate-300">${escapeHtml(r.reply_content?.body || '')}</p>
      </div>
      <button onclick="deletePortalRule('${r.id}')" class="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>
  `).join('');
  lucide.createIcons();
}

function openNewPortalRuleModal() {
  document.getElementById('pform-keyword').value = '';
  document.getElementById('pform-body').value = '';
  document.getElementById('pform-btn-1').value = '';
  document.getElementById('pform-btn-2').value = '';
  document.getElementById('pform-reply-type').value = 'text';
  togglePortalRuleFields();
  document.getElementById('portal-rule-modal').classList.remove('hidden');
}

function closePortalRuleModal() {
  document.getElementById('portal-rule-modal').classList.add('hidden');
}

function togglePortalRuleFields() {
  const type = document.getElementById('pform-reply-type').value;
  const box = document.getElementById('pform-buttons-box');
  if (type === 'interactive_buttons') box.classList.remove('hidden');
  else box.classList.add('hidden');
}

async function savePortalRule(e) {
  e.preventDefault();
  const keyword = document.getElementById('pform-keyword').value.trim();
  const reply_type = document.getElementById('pform-reply-type').value;
  const body = document.getElementById('pform-body').value.trim();

  let reply_content = { body };
  if (reply_type === 'interactive_buttons') {
    const b1 = document.getElementById('pform-btn-1').value.trim();
    const b2 = document.getElementById('pform-btn-2').value.trim();
    const buttons = [];
    if (b1) buttons.push({ id: 'btn_1', title: b1 });
    if (b2) buttons.push({ id: 'btn_2', title: b2 });
    reply_content.buttons = buttons;
  }

  try {
    const res = await fetch(`/api/tenants/${portalState.tenant.id}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, match_type: 'contains', reply_type, reply_content, priority: 5, is_active: true })
    });
    const json = await res.json();
    if (json.success) {
      showToast('تمت إضافة الرد الآلي بنجاح!', 'success');
      closePortalRuleModal();
      await refreshPortalData();
    } else {
      showToast(json.error || 'فشل حفظ الرد', 'error');
    }
  } catch (err) {
    showToast('خطأ في الاتصال بالخادم', 'error');
  }
}

async function deletePortalRule(ruleId) {
  if (!confirm('هل أنت متأكد من حذف هذا الرد الآلي؟')) return;
  try {
    const res = await fetch(`/api/rules/${ruleId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('تم حذف الرد بنجاح', 'success');
      await refreshPortalData();
    }
  } catch (e) {
    showToast('فشل حذف الرد', 'error');
  }
}

// ==========================================
// Business Hours & Profile Settings
// ==========================================
function populatePortalSettings(tenant) {
  document.getElementById('pset-name').value = tenant.name || '';
  document.getElementById('pset-welcome').value = tenant.welcome_reply || '';
  document.getElementById('pset-fallback').value = tenant.default_fallback_reply || '';

  const bh = tenant.business_hours || {};
  document.getElementById('hours-enabled').checked = Boolean(bh.enabled);
  document.getElementById('hours-start').value = bh.start_time || '09:00';
  document.getElementById('hours-end').value = bh.end_time || '18:00';
  document.getElementById('hours-reply').value = bh.off_hours_reply || '';
}

async function savePortalBusinessHours(e) {
  e.preventDefault();
  const enabled = document.getElementById('hours-enabled').checked;
  const start_time = document.getElementById('hours-start').value;
  const end_time = document.getElementById('hours-end').value;
  const off_hours_reply = document.getElementById('hours-reply').value.trim();

  const business_hours = {
    enabled,
    timezone: 'Africa/Cairo',
    work_days: [0, 1, 2, 3, 4],
    start_time,
    end_time,
    off_hours_reply
  };

  try {
    const res = await fetch(`/api/portal/${portalState.tenant.id}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_hours })
    });
    const json = await res.json();
    if (json.success) showToast('تم حفظ مواعيد العمل بنجاح!', 'success');
    else showToast(json.error || 'حدث خطأ', 'error');
  } catch (e) {
    showToast('خطأ في الاتصال بالخادم', 'error');
  }
}

async function savePortalProfileSettings(e) {
  e.preventDefault();
  const name = document.getElementById('pset-name').value.trim();
  const welcome_reply = document.getElementById('pset-welcome').value.trim();
  const default_fallback_reply = document.getElementById('pset-fallback').value.trim();

  try {
    const res = await fetch(`/api/portal/${portalState.tenant.id}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, welcome_reply, default_fallback_reply })
    });
    const json = await res.json();
    if (json.success) showToast('تم تحديث إعدادات الشركة بنجاح!', 'success');
    else showToast(json.error || 'حدث خطأ', 'error');
  } catch (e) {
    showToast('خطأ في الاتصال بالخادم', 'error');
  }
}

// ==========================================
// Contacts & Broadcasts
// ==========================================
function renderPortalContacts() {
  const tbody = document.getElementById('portal-contacts-tbody');
  if (!tbody) return;

  if (portalState.contacts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-500">لا يوجد عملاء مسجلين حتى الآن.</td></tr>`;
    return;
  }

  tbody.innerHTML = portalState.contacts.map(c => `
    <tr class="hover:bg-slate-800/30">
      <td class="py-3 px-4 font-bold text-white">${escapeHtml(c.name || 'عميل واتساب')}</td>
      <td class="py-3 px-4 font-mono text-cyan-400">+${c.phone_number}</td>
      <td class="py-3 px-4">
        ${(c.tags || []).map(t => `<span class="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-[10px]">${t}</span>`).join(' ')}
      </td>
      <td class="py-3 px-4 font-mono text-slate-300">${c.total_messages || 1}</td>
      <td class="py-3 px-4 text-slate-400">${new Date(c.last_message_at).toLocaleDateString('ar-EG')}</td>
    </tr>
  `).join('');
}

async function sendPortalBroadcast(e) {
  e.preventDefault();
  const name = document.getElementById('bc-name').value.trim();
  const message_body = document.getElementById('bc-body').value.trim();

  if (!confirm(`هل أنت متأكد من إرسال هذا الإعلان إلى جميع عملاء شركتك (${portalState.contacts.length} عميل)؟`)) return;

  try {
    const res = await fetch(`/api/tenants/${portalState.tenant.id}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_name: name, message_body })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      document.getElementById('bc-body').value = '';
    } else {
      showToast(json.error || 'فشل إرسال الحملة', 'error');
    }
  } catch (e) {
    showToast('خطأ في إرسال الحملة', 'error');
  }
}

function renderPortalRecentLogs(logs) {
  const container = document.getElementById('portal-recent-logs');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = '<p class="text-slate-500 py-3 text-center">لا توجد رسائل حديثة.</p>';
    return;
  }

  container.innerHTML = logs.slice(0, 4).map(l => `
    <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
      <div>
        <span class="font-bold text-white">${escapeHtml(l.sender_name || l.sender_phone)}</span>
        <p class="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">"${escapeHtml(l.message_body || '')}"</p>
      </div>
      <span class="text-[10px] text-slate-500 font-mono">${new Date(l.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  `).join('');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100' :
                  type === 'error' ? 'bg-rose-900/90 border-rose-500/50 text-rose-100' :
                  'bg-indigo-900/90 border-indigo-500/50 text-indigo-100';

  toast.className = `toast px-4 py-3 rounded-2xl border text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2 ${bgClass}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
