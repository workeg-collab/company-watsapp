const { supabase, isConfigured } = require('../config/supabase');
const fs = require('fs');
const path = require('path');

// Local fallback store in case Supabase is not yet connected
const LOCAL_STORE_FILE = path.join(__dirname, '../data/local_store.json');

// In-Memory cache for low-latency webhook lookups
const tenantCache = new Map();

class TenantService {
  constructor() {
    this.memoryData = {
      tenants: [
        {
          id: 'a0000000-0000-0000-0000-000000000001',
          name: 'Power of Media Agency',
          phone_number_id: '102938475610293',
          waba_id: '987654321098765',
          access_token: 'EAAG_SAMPLE_PERMANENT_TOKEN_POWER_OF_MEDIA',
          verify_token: 'power_of_media_verify_token_2026',
          status: 'active',
          enable_welcome: true,
          welcome_reply: 'مرحباً بك في وكالة Power of Media! 🎬🚀 نسعد بخدمتك. اكتب "خدماتنا" أو "اسعار" لمعرفة المزيد.',
          enable_fallback: true,
          default_fallback_reply: 'شكراً لتواصلك مع Power of Media. لم نتمكن من فهم طلبك بدقة، وسيتواصل معك فريقنا قريباً. 💬',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      rules: [
        {
          id: 'r0000000-0000-0000-0000-000000000001',
          tenant_id: 'a0000000-0000-0000-0000-000000000001',
          keyword: 'خدماتنا,services,خدمات',
          match_type: 'contains',
          reply_type: 'interactive_buttons',
          reply_content: {
            body: 'نقدم في Power of Media حلولاً تسويقية ورقمية متكاملة:\n\n1. إدارة الحملات الإعلانية 📢\n2. إنتاج الفيديو والمحتوى الإبداعي 🎥\n3. تطوير البرمجيات وحلول الواتساب الذكية 💻\n\nاضغط على أي زر أدناه لمزيد من التفاصيل:',
            buttons: [
              { id: 'btn_ads', title: '📢 الحملات الإعلانية' },
              { id: 'btn_video', title: '🎥 إنتاج الفيديو' },
              { id: 'btn_tech', title: '💻 البرمجيات والذكاء' }
            ]
          },
          priority: 10,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'r0000000-0000-0000-0000-000000000002',
          tenant_id: 'a0000000-0000-0000-0000-000000000001',
          keyword: 'اسعار,باقات,prices,pricing',
          match_type: 'contains',
          reply_type: 'text',
          reply_content: {
            body: '💼 للاطلاع على باقات الأسعار المخصصة لشركتك:\n\nنقدم باقات شهرية مخصصة تبدأ من باقة Start وحتى باقات Enterprise.\nيرجى زيارة موقعنا أو إرسال تفاصيل شركتك وسيقوم مسؤول المبيعات بالتواصل معك فوراً.'
          },
          priority: 5,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'r0000000-0000-0000-0000-000000000003',
          tenant_id: 'a0000000-0000-0000-0000-000000000001',
          keyword: 'موقعكم,عنوان,location,address',
          match_type: 'contains',
          reply_type: 'text',
          reply_content: {
            body: '📍 يسعدنا تشريفك في مقر وكالة Power of Media.\nساعات العمل الرسمية: الأحد إلى الخميس من 9:00 ص حتى 6:00 م.'
          },
          priority: 5,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      logs: []
    };

    this.initLocalStore();
  }

  initLocalStore() {
    if (!isConfigured) {
      try {
        const dir = path.dirname(LOCAL_STORE_FILE);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        if (fs.existsSync(LOCAL_STORE_FILE)) {
          const content = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
          this.memoryData = JSON.parse(content);
        } else {
          this.saveLocalStore();
        }
      } catch (err) {
        console.warn('[TenantService] Using volatile in-memory store:', err.message);
      }
    }
  }

  saveLocalStore() {
    if (!isConfigured) {
      try {
        fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(this.memoryData, null, 2), 'utf-8');
      } catch (err) {
        console.warn('[TenantService] Failed to persist local store file:', err.message);
      }
    }
  }

  // ==========================================
  // Tenants Management
  // ==========================================

  async getAllTenants() {
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[TenantService] Error getting all tenants from Supabase:', error.message);
        throw error;
      }
      return data || [];
    }

    return this.memoryData.tenants;
  }

  async getTenantById(id) {
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data;
    }

    return this.memoryData.tenants.find(t => t.id === id) || null;
  }

  async getTenantByPhoneNumberId(phoneNumberId) {
    if (!phoneNumberId) return null;
    const cleanId = String(phoneNumberId).trim();

    // Check memory cache first for high performance
    if (tenantCache.has(cleanId)) {
      const cached = tenantCache.get(cleanId);
      // Cache expires after 60 seconds
      if (Date.now() - cached.timestamp < 60000) {
        return cached.tenant;
      }
    }

    let tenant = null;

    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('phone_number_id', cleanId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error(`[TenantService] Error fetching tenant for phone_number_id ${cleanId}:`, error.message);
      }
      tenant = data;
    } else {
      tenant = this.memoryData.tenants.find(
        t => t.phone_number_id === cleanId && t.status === 'active'
      ) || null;
    }

    if (tenant) {
      tenantCache.set(cleanId, { tenant, timestamp: Date.now() });
    }

    return tenant;
  }

  async createTenant(tenantData) {
    const cleanPhoneId = String(tenantData.phone_number_id).trim();

    // Validate uniqueness
    const existing = await this.getTenantByPhoneNumberId(cleanPhoneId);
    if (existing) {
      throw new Error(`A client with WhatsApp Phone Number ID "${cleanPhoneId}" is already registered.`);
    }

    const payload = {
      name: tenantData.name.trim(),
      phone_number_id: cleanPhoneId,
      waba_id: tenantData.waba_id ? String(tenantData.waba_id).trim() : null,
      access_token: tenantData.access_token.trim(),
      verify_token: tenantData.verify_token ? tenantData.verify_token.trim() : null,
      status: tenantData.status || 'active',
      enable_welcome: tenantData.enable_welcome !== undefined ? Boolean(tenantData.enable_welcome) : true,
      welcome_reply: tenantData.welcome_reply || `مرحباً بك! يسعدنا تواصلك مع ${tenantData.name}. كيف يمكننا مساعدتك اليوم؟ 🚀`,
      enable_fallback: tenantData.enable_fallback !== undefined ? Boolean(tenantData.enable_fallback) : true,
      default_fallback_reply: tenantData.default_fallback_reply || 'شكراً لرسالتك. سيقوم أحد ممثلينا بالرد عليك قريباً.'
    };

    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('tenants')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    // Local in-memory mode
    const newTenant = {
      id: `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.memoryData.tenants.unshift(newTenant);
    this.saveLocalStore();
    return newTenant;
  }

  async updateTenant(id, tenantData) {
    // Invalidate cache
    tenantCache.clear();

    const payload = {
      ...tenantData,
      updated_at: new Date().toISOString()
    };

    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('tenants')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const index = this.memoryData.tenants.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Tenant not found.');

    this.memoryData.tenants[index] = {
      ...this.memoryData.tenants[index],
      ...payload
    };
    this.saveLocalStore();
    return this.memoryData.tenants[index];
  }

  async deleteTenant(id) {
    tenantCache.clear();

    if (isConfigured && supabase) {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    }

    this.memoryData.tenants = this.memoryData.tenants.filter(t => t.id !== id);
    this.memoryData.rules = this.memoryData.rules.filter(r => r.tenant_id !== id);
    this.memoryData.logs = this.memoryData.logs.filter(l => l.tenant_id !== id);
    this.saveLocalStore();
    return { success: true };
  }

  // ==========================================
  // Auto-Reply Rules Management
  // ==========================================

  async getRulesByTenantId(tenantId) {
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('auto_reply_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }

    return this.memoryData.rules
      .filter(r => r.tenant_id === tenantId)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  async getActiveRulesForTenant(tenantId) {
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('auto_reply_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) throw error;
      return data || [];
    }

    return this.memoryData.rules
      .filter(r => r.tenant_id === tenantId && r.is_active)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  async createRule(tenantId, ruleData) {
    const payload = {
      tenant_id: tenantId,
      keyword: ruleData.keyword.trim(),
      match_type: ruleData.match_type || 'contains',
      reply_type: ruleData.reply_type || 'text',
      reply_content: typeof ruleData.reply_content === 'string' 
        ? JSON.parse(ruleData.reply_content) 
        : ruleData.reply_content,
      priority: parseInt(ruleData.priority, 10) || 0,
      is_active: ruleData.is_active !== undefined ? Boolean(ruleData.is_active) : true
    };

    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('auto_reply_rules')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const newRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.memoryData.rules.unshift(newRule);
    this.saveLocalStore();
    return newRule;
  }

  async updateRule(ruleId, ruleData) {
    const payload = {
      ...ruleData,
      updated_at: new Date().toISOString()
    };

    if (payload.reply_content && typeof payload.reply_content === 'string') {
      try {
        payload.reply_content = JSON.parse(payload.reply_content);
      } catch (e) {
        // Keep as is if parsing fails
      }
    }

    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('auto_reply_rules')
        .update(payload)
        .eq('id', ruleId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    const index = this.memoryData.rules.findIndex(r => r.id === ruleId);
    if (index === -1) throw new Error('Rule not found.');

    this.memoryData.rules[index] = {
      ...this.memoryData.rules[index],
      ...payload
    };
    this.saveLocalStore();
    return this.memoryData.rules[index];
  }

  async deleteRule(ruleId) {
    if (isConfigured && supabase) {
      const { error } = await supabase
        .from('auto_reply_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      return { success: true };
    }

    this.memoryData.rules = this.memoryData.rules.filter(r => r.id !== ruleId);
    this.saveLocalStore();
    return { success: true };
  }

  // ==========================================
  // Message Logs & Audit Trail
  // ==========================================

  async logMessage(logData) {
    const payload = {
      tenant_id: logData.tenant_id || null,
      phone_number_id: logData.phone_number_id,
      direction: logData.direction || 'inbound',
      sender_phone: logData.sender_phone,
      sender_name: logData.sender_name || null,
      recipient_phone: logData.recipient_phone || null,
      message_body: logData.message_body || null,
      message_type: logData.message_type || 'text',
      matched_rule_id: logData.matched_rule_id || null,
      response_body: logData.response_body || null,
      status: logData.status || 'received',
      error_message: logData.error_message || null,
      raw_payload: logData.raw_payload || null
    };

    if (isConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('message_logs')
          .insert(payload)
          .select()
          .single();

        if (error) console.error('[TenantService] Failed to insert log to Supabase:', error.message);
        return data;
      } catch (err) {
        console.error('[TenantService] Logging exception:', err.message);
      }
    }

    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...payload,
      created_at: new Date().toISOString()
    };
    this.memoryData.logs.unshift(newLog);
    // Keep max 200 logs in memory
    if (this.memoryData.logs.length > 200) {
      this.memoryData.logs.length = 200;
    }
    this.saveLocalStore();
    return newLog;
  }

  async getLogs(filters = {}) {
    const limit = parseInt(filters.limit, 10) || 50;

    if (isConfigured && supabase) {
      let query = supabase
        .from('message_logs')
        .select('*, tenants(name)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (filters.tenant_id) {
        query = query.eq('tenant_id', filters.tenant_id);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.phone_number_id) {
        query = query.eq('phone_number_id', filters.phone_number_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }

    let results = [...this.memoryData.logs];
    if (filters.tenant_id) {
      results = results.filter(l => l.tenant_id === filters.tenant_id);
    }
    if (filters.status) {
      results = results.filter(l => l.status === filters.status);
    }
    if (filters.phone_number_id) {
      results = results.filter(l => l.phone_number_id === filters.phone_number_id);
    }

    // Attach tenant names
    const enriched = results.slice(0, limit).map(l => {
      const tenant = this.memoryData.tenants.find(t => t.id === l.tenant_id);
      return {
        ...l,
        tenants: tenant ? { name: tenant.name } : null
      };
    });

    return enriched;
  }

  async getStats() {
    const tenants = await this.getAllTenants();
    const logs = await this.getLogs({ limit: 1000 });

    const totalTenants = tenants.length;
    const activeTenants = tenants.filter(t => t.status === 'active').length;
    const totalLogs = logs.length;
    const repliedLogs = logs.filter(l => l.status === 'replied' || l.status === 'fallback_sent').length;
    const failedLogs = logs.filter(l => l.status === 'failed').length;

    return {
      totalTenants,
      activeTenants,
      totalMessages: totalLogs,
      autoRepliedCount: repliedLogs,
      failedCount: failedLogs,
      autoReplyRate: totalLogs > 0 ? Math.round((repliedLogs / totalLogs) * 100) : 0,
      databaseType: isConfigured ? 'Supabase PostgreSQL' : 'Local In-Memory Cache'
    };
  }
}

module.exports = new TenantService();
