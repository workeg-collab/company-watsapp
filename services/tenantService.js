const { supabase, isConfigured } = require('../config/supabase');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOCAL_STORE_FILE = path.join(__dirname, '../data/local_store.json');
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
          portal_key: 'pom_portal_demo_key',
          portal_pin: '123456',
          status: 'active',
          enable_welcome: true,
          welcome_reply: 'مرحباً بك في وكالة Power of Media! 🎬🚀 نسعد بخدمتك. اكتب "خدماتنا" أو "اسعار" لمعرفة المزيد.',
          enable_fallback: true,
          default_fallback_reply: 'شكراً لتواصلك مع Power of Media. لم نتمكن من فهم طلبك بدقة، وسيتواصل معك فريقنا قريباً. 💬',
          business_hours: {
            enabled: false,
            timezone: 'Africa/Cairo',
            work_days: [0, 1, 2, 3, 4],
            start_time: '09:00',
            end_time: '18:00',
            off_hours_reply: 'شكراً لتواصلك مع Power of Media! ⏰ مواعيد العمل الرسمية من الأحد إلى الخميس من 9 ص حتى 6 م.'
          },
          webhook_forward_url: '',
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
      contacts: [
        {
          id: 'c0000000-0000-0000-0000-000000000001',
          tenant_id: 'a0000000-0000-0000-0000-000000000001',
          phone_number: '201012345678',
          name: 'أحمد علي',
          tags: ['VIP', 'مهتم بالإعلانات'],
          total_messages: 5,
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        },
        {
          id: 'c0000000-0000-0000-0000-000000000002',
          tenant_id: 'a0000000-0000-0000-0000-000000000001',
          phone_number: '201098765432',
          name: 'سارة محمد',
          tags: ['عميل محتمل', 'إنتاج فيديو'],
          total_messages: 2,
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }
      ],
      broadcasts: [],
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
          const parsed = JSON.parse(content);
          this.memoryData = {
            ...this.memoryData,
            ...parsed,
            tenants: (parsed.tenants || this.memoryData.tenants).map(t => ({
              ...t,
              portal_key: t.portal_key || 'pom_portal_demo_key',
              portal_pin: t.portal_pin || '123456',
              business_hours: t.business_hours || {
                enabled: false,
                timezone: 'Africa/Cairo',
                work_days: [0, 1, 2, 3, 4],
                start_time: '09:00',
                end_time: '18:00',
                off_hours_reply: 'مواعيد العمل الرسمية من 9:00 ص إلى 6:00 م.'
              }
            })),
            contacts: parsed.contacts || this.memoryData.contacts,
            broadcasts: parsed.broadcasts || []
          };
          this.saveLocalStore();
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

      if (error) throw error;
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
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    }
    return this.memoryData.tenants.find(t => t.id === id) || null;
  }

  async getTenantByPortalKey(portalKey) {
    if (!portalKey) return null;
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('portal_key', portalKey.trim())
        .maybeSingle();
      if (error) return null;
      return data;
    }
    return this.memoryData.tenants.find(t => t.portal_key === portalKey.trim()) || null;
  }

  async authenticatePortal(identifier, pinOrKey) {
    if (!identifier || !pinOrKey) return null;
    const cleanPin = String(pinOrKey).trim();
    const cleanId = String(identifier).trim();

    let tenant = null;
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .or(`id.eq.${cleanId},portal_key.eq.${cleanId}`)
        .maybeSingle();

      if (data && (data.portal_pin === cleanPin || data.portal_key === cleanPin || data.id === cleanPin)) {
        tenant = data;
      }
    } else {
      tenant = this.memoryData.tenants.find(
        t => (t.id === cleanId || t.portal_key === cleanId) && (t.portal_pin === cleanPin || t.portal_key === cleanPin)
      ) || null;
    }
    return tenant;
  }

  async getTenantByPhoneNumberId(phoneNumberId) {
    if (!phoneNumberId) return null;
    const cleanId = String(phoneNumberId).trim();

    if (tenantCache.has(cleanId)) {
      const cached = tenantCache.get(cleanId);
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

      if (error) console.error(`[TenantService] Supabase error for ${cleanId}:`, error.message);
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

    const existing = await this.getTenantByPhoneNumberId(cleanPhoneId);
    if (existing) {
      throw new Error(`A client with WhatsApp Phone Number ID "${cleanPhoneId}" is already registered.`);
    }

    const portalKey = 'pk_' + crypto.randomBytes(6).toString('hex');
    const portalPin = Math.floor(100000 + Math.random() * 900000).toString();

    const payload = {
      name: tenantData.name.trim(),
      phone_number_id: cleanPhoneId,
      waba_id: tenantData.waba_id ? String(tenantData.waba_id).trim() : null,
      access_token: tenantData.access_token.trim(),
      verify_token: tenantData.verify_token ? tenantData.verify_token.trim() : null,
      portal_key: portalKey,
      portal_pin: portalPin,
      status: tenantData.status || 'active',
      enable_welcome: tenantData.enable_welcome !== undefined ? Boolean(tenantData.enable_welcome) : true,
      welcome_reply: tenantData.welcome_reply || `مرحباً بك! يسعدنا تواصلك مع ${tenantData.name}. كيف يمكننا مساعدتك اليوم؟ 🚀`,
      enable_fallback: tenantData.enable_fallback !== undefined ? Boolean(tenantData.enable_fallback) : true,
      default_fallback_reply: tenantData.default_fallback_reply || 'شكراً لرسالتك. سيقوم أحد ممثلينا بالرد عليك قريباً.',
      business_hours: tenantData.business_hours || {
        enabled: false,
        timezone: 'Africa/Cairo',
        work_days: [0, 1, 2, 3, 4],
        start_time: '09:00',
        end_time: '18:00',
        off_hours_reply: `شكراً لتواصلك مع ${tenantData.name}! ⏰ مواعيد العمل الرسمية من الأحد إلى الخميس من 9:00 ص حتى 6:00 م.`
      },
      webhook_forward_url: tenantData.webhook_forward_url || ''
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
    this.memoryData.contacts = this.memoryData.contacts.filter(c => c.tenant_id !== id);
    this.saveLocalStore();
    return { success: true };
  }

  // ==========================================
  // Rules Management
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
      try { payload.reply_content = JSON.parse(payload.reply_content); } catch (e) {}
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
  // Contacts Management
  // ==========================================

  async upsertContact(tenantId, phone, name) {
    if (!tenantId || !phone) return null;
    const cleanPhone = String(phone).replace(/\D/g, '');

    if (isConfigured && supabase) {
      try {
        const { data: existing } = await supabase
          .from('contacts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('phone_number', cleanPhone)
          .maybeSingle();

        if (existing) {
          const { data } = await supabase
            .from('contacts')
            .update({
              name: name || existing.name,
              total_messages: (existing.total_messages || 0) + 1,
              last_message_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();
          return data;
        } else {
          const { data } = await supabase
            .from('contacts')
            .insert({
              tenant_id: tenantId,
              phone_number: cleanPhone,
              name: name || 'عميل واتساب',
              tags: ['عميل جديد'],
              total_messages: 1,
              last_message_at: new Date().toISOString()
            })
            .select()
            .single();
          return data;
        }
      } catch (err) {
        console.error('[TenantService] upsertContact error:', err.message);
      }
    }

    let contact = this.memoryData.contacts.find(c => c.tenant_id === tenantId && c.phone_number === cleanPhone);
    if (contact) {
      contact.name = name || contact.name;
      contact.total_messages = (contact.total_messages || 0) + 1;
      contact.last_message_at = new Date().toISOString();
    } else {
      contact = {
        id: `contact_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tenant_id: tenantId,
        phone_number: cleanPhone,
        name: name || 'عميل واتساب',
        tags: ['عميل جديد'],
        total_messages: 1,
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      this.memoryData.contacts.unshift(contact);
    }
    this.saveLocalStore();
    return contact;
  }

  async getContactsByTenantId(tenantId) {
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    return this.memoryData.contacts
      .filter(c => c.tenant_id === tenantId)
      .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
  }

  async updateContactTags(contactId, tags) {
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('contacts')
        .update({ tags })
        .eq('id', contactId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const contact = this.memoryData.contacts.find(c => c.id === contactId);
    if (contact) {
      contact.tags = tags;
      this.saveLocalStore();
    }
    return contact;
  }

  // ==========================================
  // Live Chat / Conversations
  // ==========================================

  async getConversations(tenantId) {
    const logs = await this.getLogs({ tenant_id: tenantId, limit: 300 });
    const convMap = new Map();

    for (const log of logs) {
      const phone = log.sender_phone || log.recipient_phone;
      if (!phone) continue;

      if (!convMap.has(phone)) {
        convMap.set(phone, {
          phone,
          senderName: log.sender_name || 'Customer',
          lastMessage: log.message_body || log.response_body || '',
          lastMessageAt: log.created_at,
          status: log.status,
          unreadCount: 0
        });
      }
    }

    return Array.from(convMap.values()).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
  }

  async getConversationMessages(tenantId, phone) {
    const cleanPhone = String(phone).replace(/\D/g, '');

    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('message_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`sender_phone.eq.${cleanPhone},recipient_phone.eq.${cleanPhone}`)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      return data || [];
    }

    return this.memoryData.logs
      .filter(l => l.tenant_id === tenantId && (l.sender_phone === cleanPhone || l.recipient_phone === cleanPhone))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  // ==========================================
  // Broadcast Campaigns
  // ==========================================

  async createBroadcastCampaign(tenantId, campaignData) {
    const payload = {
      tenant_id: tenantId,
      name: campaignData.name,
      message_body: campaignData.message_body,
      target_type: campaignData.target_type || 'all_contacts',
      total_recipients: campaignData.total_recipients || 0,
      success_count: campaignData.success_count || 0,
      failed_count: campaignData.failed_count || 0,
      status: campaignData.status || 'completed'
    };

    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('broadcast_campaigns')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const campaign = {
      id: `bc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...payload,
      created_at: new Date().toISOString()
    };
    this.memoryData.broadcasts.unshift(campaign);
    this.saveLocalStore();
    return campaign;
  }

  async getBroadcastCampaigns(tenantId) {
    if (isConfigured && supabase) {
      const { data, error } = await supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    return this.memoryData.broadcasts.filter(b => b.tenant_id === tenantId);
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

    // Also upsert contact
    if (logData.tenant_id && logData.sender_phone && logData.direction === 'inbound') {
      this.upsertContact(logData.tenant_id, logData.sender_phone, logData.sender_name).catch(() => {});
    }

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
    if (this.memoryData.logs.length > 500) {
      this.memoryData.logs.length = 500;
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

      if (filters.tenant_id) query = query.eq('tenant_id', filters.tenant_id);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.phone_number_id) query = query.eq('phone_number_id', filters.phone_number_id);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }

    let results = [...this.memoryData.logs];
    if (filters.tenant_id) results = results.filter(l => l.tenant_id === filters.tenant_id);
    if (filters.status) results = results.filter(l => l.status === filters.status);
    if (filters.phone_number_id) results = results.filter(l => l.phone_number_id === filters.phone_number_id);

    return results.slice(0, limit).map(l => {
      const tenant = this.memoryData.tenants.find(t => t.id === l.tenant_id);
      return { ...l, tenants: tenant ? { name: tenant.name } : null };
    });
  }

  async getStats(tenantId = null) {
    const tenants = await this.getAllTenants();
    const logs = await this.getLogs({ tenant_id: tenantId, limit: 1000 });

    const totalTenants = tenants.length;
    const activeTenants = tenants.filter(t => t.status === 'active').length;
    const totalLogs = logs.length;
    const repliedLogs = logs.filter(l => l.status === 'replied' || l.status === 'fallback_sent' || l.status === 'manual_sent').length;
    const failedLogs = logs.filter(l => l.status === 'failed').length;

    let contactsCount = 0;
    if (tenantId) {
      const contacts = await this.getContactsByTenantId(tenantId);
      contactsCount = contacts.length;
    } else {
      contactsCount = this.memoryData.contacts.length;
    }

    return {
      totalTenants,
      activeTenants,
      totalMessages: totalLogs,
      autoRepliedCount: repliedLogs,
      failedCount: failedLogs,
      contactsCount,
      autoReplyRate: totalLogs > 0 ? Math.round((repliedLogs / totalLogs) * 100) : 0,
      databaseType: isConfigured ? 'Supabase PostgreSQL' : 'Local In-Memory Cache'
    };
  }
}

module.exports = new TenantService();
