// =========================================================================
// Power of Media - WhatsApp SaaS Dashboard Controller
// =========================================================================

let state = {
  activeTab: 'overview',
  tenants: [],
  selectedTenantId: null,
  rules: [],
  logs: [],
  stats: {},
  simulatorMessages: []
};

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  setupDynamicUrls();
  await refreshData();
});

function setupDynamicUrls() {
  const origin = window.location.origin;
  const webhookUrlInput = document.getElementById('setting-webhook-url');
  if (webhookUrlInput) {
    webhookUrlInput.value = `${origin}/api/webhook`;
  }
}

async function refreshData() {
  await Promise.all([
    loadStats(),
    loadTenants(),
    loadLogs()
  ]);
  lucide.createIcons();
}

// =========================================================================
// Tab Navigation
// =========================================================================
function switchTab(tabId) {
  state.activeTab = tabId;

  // Update tabs visibility
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.add('hidden');
  });
  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.remove('hidden');

  // Update nav button styling
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.className = 'nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-slate-800/50';
  });
  const activeNav = document.getElementById(`nav-${tabId}`);
  if (activeNav) {
    activeNav.className = 'nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all bg-indigo-600/15 text-indigo-400 border border-indigo-500/20';
  }

  // Update Header Title
  const titleMap = {
    overview: 'لوحة تحكم المنظومة المركزية',
    tenants: 'إدارة الشركات والعملاء (Tenants)',
    rules: 'قواعد الرد التلقائي (Auto-Reply Rules)',
    simulator: 'محاكي الشات بوت التفاعلي (WhatsApp Simulator)',
    logs: 'سجل الرسائل والويب هوك (Audit Trail)',
    settings: 'إعدادات الربط والنشر (Meta & Deployment)'
  };
  document.getElementById('page-title').innerText = titleMap[tabId] || 'لوحة التحكم';

  if (tabId === 'rules') {
    populateTenantDropdowns();
    loadRulesForSelectedTenant();
  } else if (tabId === 'simulator') {
    populateTenantDropdowns();
    initSimulator();
  }

  lucide.createIcons();
}

// =========================================================================
// Stats & Overview
// =========================================================================
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (json.success) {
      state.stats = json.data;
      document.getElementById('stat-tenants').innerText = json.data.totalTenants || 0;
      document.getElementById('stat-active-tenants').innerText = json.data.activeTenants || 0;
      document.getElementById('stat-messages').innerText = json.data.totalMessages || 0;
      document.getElementById('stat-reply-rate').innerText = `${json.data.autoReplyRate || 0}%`;

      const dbBadge = document.getElementById('db-badge');
      if (json.data.databaseType.includes('Supabase')) {
        dbBadge.innerText = '🟢 Supabase PostgreSQL';
        dbBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-medium';
      } else {
        dbBadge.innerText = '⚡ Local Fallback Store';
        dbBadge.className = 'text-xs px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 font-medium';
      }
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// =========================================================================
// Tenants Management
// =========================================================================
async function loadTenants() {
  try {
    const res = await fetch('/api/tenants');
    const json = await res.json();
    if (json.success) {
      state.tenants = json.data;
      renderTenantsGrid();
      populateTenantDropdowns();
    }
  } catch (err) {
    showToast('فشل تحميل قائمة الشركات', 'error');
  }
}

function renderTenantsGrid() {
  const container = document.getElementById('tenants-grid');
  if (!container) return;

  if (state.tenants.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-500">
        <i data-lucide="building" class="w-12 h-12 mx-auto mb-3 opacity-30"></i>
        <p class="text-sm font-semibold">لم يتم تسجيل أي شركة حتى الآن</p>
        <button onclick="openNewTenantModal()" class="mt-3 text-xs text-indigo-400 font-bold hover:underline">+ اضغط هنا لإضافة أول شركة</button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = state.tenants.map(tenant => `
    <div class="glass-panel glass-panel-hover p-5 rounded-3xl space-y-4 border border-slate-800 flex flex-col justify-between">
      <div>
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400">
              ${tenant.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h4 class="font-bold text-sm text-white">${tenant.name}</h4>
              <span class="text-[11px] text-slate-400 font-mono">ID: ${tenant.id.substring(0, 8)}...</span>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${tenant.status === 'active' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'}">
            ${tenant.status === 'active' ? 'نشط' : 'متوقف'}
          </span>
        </div>

        <div class="space-y-2 text-xs bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
          <div class="flex justify-between">
            <span class="text-slate-400">Phone Number ID:</span>
            <span class="font-mono text-cyan-400 font-semibold select-all">${tenant.phone_number_id}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Token Status:</span>
            <span class="font-mono text-emerald-400">● Configured</span>
          </div>
          ${tenant.waba_id ? `
          <div class="flex justify-between">
            <span class="text-slate-400">WABA ID:</span>
            <span class="font-mono text-slate-300 select-all">${tenant.waba_id}</span>
          </div>` : ''}
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
        <button onclick="manageTenantRules('${tenant.id}')" class="flex-1 py-2 px-3 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all">
          <i data-lucide="bot" class="w-3.5 h-3.5"></i>
          القواعد
        </button>
        <button onclick="testInSimulator('${tenant.id}')" class="py-2 px-3 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-xs font-semibold flex items-center gap-1 transition-all">
          <i data-lucide="play" class="w-3.5 h-3.5"></i>
          تجربة
        </button>
        <button onclick="deleteTenant('${tenant.id}', '${tenant.name}')" class="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

function populateTenantDropdowns() {
  const rulesSelect = document.getElementById('rules-tenant-select');
  const simSelect = document.getElementById('simulator-tenant-select');

  const options = state.tenants.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  if (rulesSelect) {
    const currentVal = rulesSelect.value;
    rulesSelect.innerHTML = options;
    if (state.selectedTenantId) rulesSelect.value = state.selectedTenantId;
    else if (state.tenants.length > 0) state.selectedTenantId = state.tenants[0].id;
  }

  if (simSelect) {
    const currentVal = simSelect.value;
    simSelect.innerHTML = options;
    if (state.selectedTenantId) simSelect.value = state.selectedTenantId;
  }
}

function openNewTenantModal() {
  document.getElementById('tenant-modal-title').innerText = 'إضافة شركة / عميل جديد';
  document.getElementById('tenant-form').reset();
  document.getElementById('form-tenant-id').value = '';
  document.getElementById('token-test-feedback').classList.add('hidden');
  document.getElementById('tenant-modal').classList.remove('hidden');
}

function closeTenantModal() {
  document.getElementById('tenant-modal').classList.add('hidden');
}

async function testMetaCredentials() {
  const phoneId = document.getElementById('form-tenant-phone-id').value.trim();
  const token = document.getElementById('form-tenant-token').value.trim();
  const feedback = document.getElementById('token-test-feedback');

  if (!phoneId || !token) {
    showToast('يرجى كتابة Phone Number ID و Access Token أولاً للتحقق', 'error');
    return;
  }

  feedback.classList.remove('hidden');
  feedback.className = 'mt-2 text-xs text-amber-400 p-2 rounded-xl bg-amber-950/40 border border-amber-800/40';
  feedback.innerText = 'جاري الاتصال بـ Meta Graph API للتحقق من الصلاحية...';

  try {
    const res = await fetch('/api/tenants/validate-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number_id: phoneId, access_token: token })
    });
    const json = await res.json();

    if (json.valid) {
      feedback.className = 'mt-2 text-xs text-emerald-400 p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800/50 font-semibold';
      feedback.innerHTML = `✅ تم التحقق بنجاح!<br>اسم الحساب: ${json.data?.verified_name || 'Verified'} | الهاتف: ${json.data?.display_phone_number || '-'}`;
      showToast('البيانات صحيحة وصالحة مع Meta!', 'success');
    } else {
      feedback.className = 'mt-2 text-xs text-rose-400 p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/50 font-medium';
      feedback.innerText = `❌ فشل التحقق: ${json.error || 'Token غير صالح أو الرقم غير صحيح'}`;
    }
  } catch (err) {
    feedback.className = 'mt-2 text-xs text-rose-400 p-2.5 rounded-xl bg-rose-950/50 border border-rose-800/50';
    feedback.innerText = `خطأ في الاتصال: ${err.message}`;
  }
}

async function saveTenant(e) {
  e.preventDefault();
  const id = document.getElementById('form-tenant-id').value;
  const name = document.getElementById('form-tenant-name').value.trim();
  const phone_number_id = document.getElementById('form-tenant-phone-id').value.trim();
  const waba_id = document.getElementById('form-tenant-waba-id').value.trim();
  const access_token = document.getElementById('form-tenant-token').value.trim();
  const welcome_reply = document.getElementById('form-tenant-welcome').value.trim();
  const default_fallback_reply = document.getElementById('form-tenant-fallback').value.trim();

  const payload = {
    name,
    phone_number_id,
    waba_id,
    access_token,
    welcome_reply,
    default_fallback_reply
  };

  try {
    const url = id ? `/api/tenants/${id}` : '/api/tenants';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (json.success) {
      showToast('تم حفظ بيانات العميل بنجاح!', 'success');
      closeTenantModal();
      await refreshData();
    } else {
      showToast(json.error || 'حدث خطأ أثناء الحفظ', 'error');
    }
  } catch (err) {
    showToast('فشل في إرسال البيانات للسيرفر', 'error');
  }
}

async function deleteTenant(id, name) {
  if (!confirm(`هل أنت متأكد من حذف الشركة "${name}" وجميع قواعدها؟`)) return;

  try {
    const res = await fetch(`/api/tenants/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('تم حذف الشركة بنجاح', 'success');
      await refreshData();
    } else {
      showToast(json.error || 'فشل حذف الشركة', 'error');
    }
  } catch (err) {
    showToast('خطأ في الاتصال بالخادم', 'error');
  }
}

function manageTenantRules(tenantId) {
  state.selectedTenantId = tenantId;
  switchTab('rules');
}

function testInSimulator(tenantId) {
  state.selectedTenantId = tenantId;
  switchTab('simulator');
}

// =========================================================================
// Rules Management
// =========================================================================
async function loadRulesForSelectedTenant() {
  const select = document.getElementById('rules-tenant-select');
  if (!select) return;
  const tenantId = select.value;
  state.selectedTenantId = tenantId;

  if (!tenantId) {
    document.getElementById('rules-list-container').innerHTML = `
      <p class="text-xs text-slate-500 py-6 text-center">يرجى اختيار شركة لعرض قواعد الرد التلقائي الخاصة بها.</p>
    `;
    return;
  }

  try {
    const res = await fetch(`/api/tenants/${tenantId}/rules`);
    const json = await res.json();
    if (json.success) {
      state.rules = json.data;
      renderRulesList();
    }
  } catch (err) {
    showToast('فشل تحميل القواعد', 'error');
  }
}

function renderRulesList() {
  const container = document.getElementById('rules-list-container');
  if (!container) return;

  if (state.rules.length === 0) {
    container.innerHTML = `
      <div class="glass-panel p-8 rounded-3xl text-center text-slate-500 border border-slate-800">
        <i data-lucide="bot" class="w-10 h-10 mx-auto mb-2 opacity-40 text-cyan-400"></i>
        <p class="text-sm font-semibold text-slate-300">لا توجد قواعد رد تلقائي مخصصة لهذه الشركة</p>
        <p class="text-xs text-slate-500 mt-1">سيتم تطبيق رسالة الترحيب والرد الاحتياطي الافتراضي للشركة عند وصول أي رسالة.</p>
        <button onclick="openNewRuleModal()" class="mt-4 text-xs font-bold text-cyan-400 hover:underline">+ اضغط هنا لإضافة أول كلمة مفتاحية</button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = state.rules.map((rule, idx) => {
    const keywords = rule.keyword.split(',').map(k => `<span class="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 font-mono text-[11px] border border-indigo-500/20">${k.trim()}</span>`).join(' ');

    let replyPreview = '';
    if (rule.reply_type === 'interactive_buttons') {
      const buttons = rule.reply_content?.buttons || [];
      replyPreview = `
        <p class="text-slate-200 text-xs mb-2 whitespace-pre-line">${rule.reply_content?.body || ''}</p>
        <div class="flex flex-wrap gap-1.5">
          ${buttons.map(b => `<span class="px-2.5 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">🔘 ${b.title}</span>`).join('')}
        </div>
      `;
    } else {
      replyPreview = `<p class="text-slate-200 text-xs whitespace-pre-line">${rule.reply_content?.body || JSON.stringify(rule.reply_content)}</p>`;
    }

    return `
      <div class="glass-panel glass-panel-hover p-5 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div class="space-y-2 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-bold text-slate-400">الكلمات:</span>
            ${keywords}
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              مطابقة: ${rule.match_type}
            </span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
              ${rule.reply_type === 'interactive_buttons' ? 'أزرار تفاعلية' : 'نص'}
            </span>
          </div>
          <div class="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80">
            ${replyPreview}
          </div>
        </div>

        <div class="flex items-center gap-3 self-end md:self-center">
          <button onclick="toggleRuleActive('${rule.id}', ${!rule.is_active})" class="px-3 py-1.5 rounded-xl text-xs font-semibold ${rule.is_active ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}">
            ${rule.is_active ? 'مفعلة' : 'معطلة'}
          </button>
          <button onclick="deleteRule('${rule.id}')" class="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function openNewRuleModal() {
  if (!state.selectedTenantId && state.tenants.length > 0) {
    state.selectedTenantId = state.tenants[0].id;
  }
  if (!state.selectedTenantId) {
    showToast('يرجى إضافة شركة أولاً قبل إنشاء القواعد', 'error');
    return;
  }

  document.getElementById('rule-form').reset();
  document.getElementById('form-rule-id').value = '';
  toggleReplyTypeFields();
  document.getElementById('rule-modal').classList.remove('hidden');
}

function closeRuleModal() {
  document.getElementById('rule-modal').classList.add('hidden');
}

function toggleReplyTypeFields() {
  const type = document.getElementById('form-rule-reply-type').value;
  const btnContainer = document.getElementById('rule-buttons-container');
  if (type === 'interactive_buttons') {
    btnContainer.classList.remove('hidden');
  } else {
    btnContainer.classList.add('hidden');
  }
}

async function saveRule(e) {
  e.preventDefault();
  const ruleId = document.getElementById('form-rule-id').value;
  const keyword = document.getElementById('form-rule-keyword').value.trim();
  const match_type = document.getElementById('form-rule-match-type').value;
  const reply_type = document.getElementById('form-rule-reply-type').value;
  const body = document.getElementById('form-rule-body').value.trim();

  let reply_content = { body };

  if (reply_type === 'interactive_buttons') {
    const b1 = document.getElementById('form-btn-1').value.trim();
    const b2 = document.getElementById('form-btn-2').value.trim();
    const b3 = document.getElementById('form-btn-3').value.trim();

    const buttons = [];
    if (b1) buttons.push({ id: 'btn_1', title: b1 });
    if (b2) buttons.push({ id: 'btn_2', title: b2 });
    if (b3) buttons.push({ id: 'btn_3', title: b3 });

    if (buttons.length === 0) {
      showToast('يرجى كتابة عنوان زر واحد على الأقل للأزرار التفاعلية', 'error');
      return;
    }
    reply_content.buttons = buttons;
  }

  const payload = {
    keyword,
    match_type,
    reply_type,
    reply_content,
    priority: 5,
    is_active: true
  };

  try {
    const url = ruleId ? `/api/rules/${ruleId}` : `/api/tenants/${state.selectedTenantId}/rules`;
    const method = ruleId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (json.success) {
      showToast('تم حفظ القاعدة بنجاح!', 'success');
      closeRuleModal();
      await loadRulesForSelectedTenant();
    } else {
      showToast(json.error || 'حدث خطأ أثناء الحفظ', 'error');
    }
  } catch (err) {
    showToast('فشل في الاتصال بالخادم', 'error');
  }
}

async function toggleRuleActive(ruleId, newStatus) {
  try {
    const res = await fetch(`/api/rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      await loadRulesForSelectedTenant();
    }
  } catch (err) {
    showToast('فشل تحديث حالة القاعدة', 'error');
  }
}

async function deleteRule(ruleId) {
  if (!confirm('هل أنت متأكد من حذف هذه القاعدة؟')) return;
  try {
    const res = await fetch(`/api/rules/${ruleId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('تم حذف القاعدة بنجاح', 'success');
      await loadRulesForSelectedTenant();
    }
  } catch (err) {
    showToast('فشل حذف القاعدة', 'error');
  }
}

// =========================================================================
// WhatsApp Simulator
// =========================================================================
function initSimulator() {
  const select = document.getElementById('simulator-tenant-select');
  if (!select) return;
  const tenantId = select.value || state.selectedTenantId;
  const tenant = state.tenants.find(t => t.id === tenantId);

  if (tenant) {
    document.getElementById('sim-header-name').innerText = tenant.name;
    document.getElementById('sim-avatar-letter').innerText = tenant.name.charAt(0).toUpperCase();
    document.getElementById('sim-diag-tenant').innerText = tenant.name;
    loadSimulatorQuickKeywords(tenant.id);
  }
}

async function loadSimulatorQuickKeywords(tenantId) {
  const container = document.getElementById('sim-quick-keywords');
  if (!container) return;

  try {
    const res = await fetch(`/api/tenants/${tenantId}/rules`);
    const json = await res.json();
    if (json.success && json.data.length > 0) {
      const keywords = [];
      json.data.forEach(r => {
        r.keyword.split(',').forEach(k => {
          if (k.trim() && !keywords.includes(k.trim())) keywords.push(k.trim());
        });
      });

      container.innerHTML = keywords.slice(0, 8).map(kw => `
        <button onclick="sendSimText('${kw}')" class="px-3 py-1 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition-all">
          "${kw}"
        </button>
      `).join('');
    } else {
      container.innerHTML = '<span class="text-xs text-slate-500">لا توجد كلمات مفتاحية مخصصة، اكتب "مرحبا" لتجربة رسالة الترحيب.</span>';
    }
  } catch (e) {}
}

function sendSimText(text) {
  document.getElementById('sim-input').value = text;
  sendSimulatorMessage();
}

function resetSimulatorChat() {
  state.simulatorMessages = [];
  const chatArea = document.getElementById('sim-chat-area');
  chatArea.innerHTML = `
    <div class="text-center my-2">
      <span class="text-[10px] bg-[#182229] text-slate-400 px-3 py-1 rounded-full border border-slate-800">
        🔒 الرسائل مشفرة تماماً ومحمية
      </span>
    </div>
  `;
  initSimulator();
}

async function sendSimulatorMessage(buttonId = null, buttonTitle = null) {
  const input = document.getElementById('sim-input');
  const messageText = buttonTitle || input.value.trim();
  const select = document.getElementById('simulator-tenant-select');
  const tenantId = select.value;

  if (!messageText && !buttonId) return;
  if (!tenantId) {
    showToast('يرجى اختيار شركة أولاً للتجربة', 'error');
    return;
  }

  // 1. Render Outbound User Bubble
  appendChatBubble({
    direction: 'out',
    text: messageText,
    time: getCurrentTime()
  });

  input.value = '';

  // 2. Call Simulation API
  try {
    const res = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenantId,
        message_text: messageText,
        button_id: buttonId,
        sender_phone: '201012345678',
        sender_name: 'عميل تجريبي'
      })
    });
    const json = await res.json();

    if (json.success) {
      const { evaluation } = json.data;

      // Update Diagnostic Drawer
      document.getElementById('sim-diag-rule').innerText = evaluation.matchedRule ? evaluation.matchedRule.keyword : (evaluation.matchReason || 'لا يوجد');
      document.getElementById('sim-diag-type').innerText = evaluation.replyType;

      // Render Bot Reply Bubble
      if (evaluation.matched && evaluation.replyContent) {
        setTimeout(() => {
          appendChatBubble({
            direction: 'in',
            replyType: evaluation.replyType,
            content: evaluation.replyContent,
            time: getCurrentTime()
          });
        }, 300);
      }
    }
  } catch (err) {
    console.error('Simulator error:', err);
  }
}

function appendChatBubble(msg) {
  const chatArea = document.getElementById('sim-chat-area');
  const div = document.createElement('div');
  div.className = `flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`;

  if (msg.direction === 'out') {
    div.innerHTML = `
      <div class="chat-bubble-out px-3.5 py-2 max-w-[80%] text-xs shadow-md">
        <p class="text-white">${escapeHtml(msg.text)}</p>
        <span class="text-[9px] text-emerald-200/60 block text-left mt-1">${msg.time} ✓✓</span>
      </div>
    `;
  } else {
    // Inbound (Bot Response)
    let bodyContent = '';
    const content = msg.content || {};

    if (msg.replyType === 'interactive_buttons' && content.buttons) {
      bodyContent = `
        <p class="text-white text-xs mb-2.5 whitespace-pre-line">${escapeHtml(content.body || '')}</p>
        <div class="space-y-1.5 border-t border-slate-700/60 pt-2">
          ${content.buttons.map(b => `
            <button onclick="sendSimulatorMessage('${b.id}', '${b.title}')" class="chat-bubble-btn w-full py-1.5 px-3 rounded-lg text-xs font-bold text-center block">
              ${escapeHtml(b.title)}
            </button>
          `).join('')}
        </div>
      `;
    } else {
      bodyContent = `<p class="text-white text-xs whitespace-pre-line">${escapeHtml(content.body || '')}</p>`;
    }

    div.innerHTML = `
      <div class="chat-bubble-in px-3.5 py-2 max-w-[85%] text-xs shadow-md">
        ${bodyContent}
        <span class="text-[9px] text-slate-400 block text-right mt-1">${msg.time}</span>
      </div>
    `;
  }

  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// =========================================================================
// Logs & Audit Trail
// =========================================================================
async function loadLogs() {
  const statusFilter = document.getElementById('logs-filter-status')?.value || '';
  try {
    const res = await fetch(`/api/logs?status=${statusFilter}&limit=50`);
    const json = await res.json();
    if (json.success) {
      state.logs = json.data;
      renderLogsTable();
      renderOverviewRecentLogs();
    }
  } catch (err) {
    console.error('Failed to load logs:', err);
  }
}

function renderLogsTable() {
  const tbody = document.getElementById('logs-table-body');
  if (!tbody) return;

  if (state.logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-500 text-xs">
          لا توجد رسائل مسجلة حتى الآن.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.logs.map(log => {
    const tenantName = log.tenants?.name || 'غير محدد';
    const timeStr = new Date(log.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let statusBadge = '';
    if (log.status === 'replied') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">تم الرد ✅</span>';
    } else if (log.status === 'fallback_sent') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">رد احتياطي ⚠️</span>';
    } else if (log.status === 'failed') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">فشل ❌</span>';
    } else {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">تجاهل ℹ️</span>';
    }

    return `
      <tr class="hover:bg-slate-800/30 transition-colors">
        <td class="py-3 px-4 text-slate-400 font-mono">${timeStr}</td>
        <td class="py-3 px-4 font-semibold text-indigo-300">${tenantName}</td>
        <td class="py-3 px-4 font-mono text-cyan-400">${log.sender_phone || '-'}</td>
        <td class="py-3 px-4 text-slate-200 max-w-xs truncate">${escapeHtml(log.message_body || '-')}</td>
        <td class="py-3 px-4 text-slate-300 max-w-xs truncate">${escapeHtml(log.response_body || '-')}</td>
        <td class="py-3 px-4">${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

function renderOverviewRecentLogs() {
  const container = document.getElementById('overview-recent-logs');
  if (!container) return;

  if (state.logs.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 py-3 text-center">لا توجد رسائل حديثة.</p>`;
    return;
  }

  container.innerHTML = state.logs.slice(0, 5).map(log => `
    <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
          <i data-lucide="message-square" class="w-4 h-4"></i>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-white">${log.tenants?.name || 'Company'}</span>
            <span class="text-slate-500 font-mono text-[10px]">${log.sender_phone || ''}</span>
          </div>
          <p class="text-slate-300 text-[11px] truncate max-w-md mt-0.5">"${escapeHtml(log.message_body || '')}"</p>
        </div>
      </div>
      <span class="text-[10px] font-mono text-slate-500">${new Date(log.created_at).toLocaleTimeString('ar-EG')}</span>
    </div>
  `).join('');

  lucide.createIcons();
}

// =========================================================================
// Helpers & Utilities
// =========================================================================
function copyWebhookUrl() {
  const url = `${window.location.origin}/api/webhook`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('تم نسخ رابط الـ Webhook إلى الحافظة!', 'success');
  });
}

function copyElementText(elementId) {
  const elem = document.getElementById(elementId);
  if (!elem) return;
  navigator.clipboard.writeText(elem.value).then(() => {
    showToast('تم النسخ بنجاح!', 'success');
  });
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

function getCurrentTime() {
  return new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
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
