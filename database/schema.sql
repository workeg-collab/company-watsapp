-- =========================================================================
-- Power of Media - Multi-Tenant WhatsApp Business SaaS Database Schema
-- Advanced Version with Client Portal, Live Chat, Contacts & Broadcasts
-- Compatible with Supabase (PostgreSQL 14+)
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. Tenants Table (Companies & Clients)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone_number_id VARCHAR(100) UNIQUE NOT NULL,
    waba_id VARCHAR(100),
    access_token TEXT NOT NULL,
    verify_token VARCHAR(255),
    portal_key VARCHAR(50) DEFAULT substring(md5(random()::text) from 1 for 10),
    portal_pin VARCHAR(10) DEFAULT floor(100000 + random() * 900000)::text,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
    enable_welcome BOOLEAN DEFAULT true,
    welcome_reply TEXT DEFAULT 'مرحباً بك! يسعدنا تواصلك مع شركة {company_name}. كيف يمكننا مساعدتك اليوم؟ 🚀',
    enable_fallback BOOLEAN DEFAULT true,
    default_fallback_reply TEXT DEFAULT 'شكراً لتواصلك معنا. لم نتمكن من فهم طلبك بدقة، وسيتم تحويلك إلى أحد ممثلي خدمة العملاء قريباً. 💬',
    
    -- Advanced Business Hours Configuration
    business_hours JSONB DEFAULT '{
        "enabled": false,
        "timezone": "Africa/Cairo",
        "work_days": [0, 1, 2, 3, 4],
        "start_time": "09:00",
        "end_time": "18:00",
        "off_hours_reply": "شكراً لتواصلك مع {company_name}! ⏰ مواعيد العمل الرسمية من الأحد إلى الخميس من 9 صباحاً حتى 6 مساءً. سنقوم بالرد عليك فور بدء أوقات العمل."
    }'::jsonb,

    -- Webhook Forwarding (optional copy to client server)
    webhook_forward_url TEXT,

    -- Custom Metadata
    custom_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_phone_number_id ON public.tenants (phone_number_id);
CREATE INDEX IF NOT EXISTS idx_tenants_portal_key ON public.tenants (portal_key);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants (status);

-- =========================================================================
-- 2. Auto-Reply & Keyword Rules Table
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.auto_reply_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    keyword VARCHAR(255) NOT NULL,
    match_type VARCHAR(30) DEFAULT 'contains' CHECK (match_type IN ('exact', 'contains', 'startsWith', 'regex', 'interactive_payload')),
    reply_type VARCHAR(30) DEFAULT 'text' CHECK (reply_type IN ('text', 'interactive_buttons', 'interactive_list', 'media')),
    reply_content JSONB NOT NULL,
    priority INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rules_tenant_id ON public.auto_reply_rules (tenant_id);
CREATE INDEX IF NOT EXISTS idx_rules_is_active ON public.auto_reply_rules (is_active);
CREATE INDEX IF NOT EXISTS idx_rules_priority ON public.auto_reply_rules (priority DESC);

-- =========================================================================
-- 3. Contacts / Audience Directory Table
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    phone_number VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    tags TEXT[] DEFAULT ARRAY['عميل جديد'],
    total_messages INT DEFAULT 1,
    last_message_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_tenant_contact UNIQUE (tenant_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON public.contacts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON public.contacts (phone_number);

-- =========================================================================
-- 4. Message Logs & Live Chat History Table
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    phone_number_id VARCHAR(100) NOT NULL,
    direction VARCHAR(20) DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
    sender_phone VARCHAR(50) NOT NULL,
    sender_name VARCHAR(255),
    recipient_phone VARCHAR(50),
    message_body TEXT,
    message_type VARCHAR(50) DEFAULT 'text',
    matched_rule_id UUID REFERENCES public.auto_reply_rules(id) ON DELETE SET NULL,
    response_body TEXT,
    status VARCHAR(30) DEFAULT 'received' CHECK (status IN ('received', 'replied', 'failed', 'ignored', 'fallback_sent', 'manual_sent', 'broadcast_sent')),
    error_message TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_tenant_id ON public.message_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.message_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_phone_number_id ON public.message_logs (phone_number_id);
CREATE INDEX IF NOT EXISTS idx_logs_sender_phone ON public.message_logs (sender_phone);

-- =========================================================================
-- 5. Broadcast Campaigns Table
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.broadcast_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    message_body TEXT NOT NULL,
    target_type VARCHAR(50) DEFAULT 'all_contacts',
    total_recipients INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_broadcast_tenant_id ON public.broadcast_campaigns (tenant_id);

-- =========================================================================
-- 6. Updated At Triggers
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_tenants_updated_at ON public.tenants;
CREATE TRIGGER set_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_rules_updated_at ON public.auto_reply_rules;
CREATE TRIGGER set_rules_updated_at
BEFORE UPDATE ON public.auto_reply_rules
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================================
-- 7. Row Level Security (RLS)
-- =========================================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_reply_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role Full Access on Tenants" ON public.tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Rules" ON public.auto_reply_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Contacts" ON public.contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Logs" ON public.message_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access on Broadcasts" ON public.broadcast_campaigns FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- 8. Seed Initial Demonstration Tenant
-- =========================================================================
INSERT INTO public.tenants (id, name, phone_number_id, waba_id, access_token, portal_key, portal_pin, status, welcome_reply, default_fallback_reply)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Power of Media Agency',
    '102938475610293',
    '987654321098765',
    'EAAG_SAMPLE_PERMANENT_TOKEN_POWER_OF_MEDIA',
    'pom_portal_demo_key',
    '123456',
    'active',
    'مرحباً بك في وكالة Power of Media! 🎬🚀 نسعد بخدمتك. اكتب "خدماتنا" أو "اسعار" لمعرفة المزيد.',
    'شكراً لرسالتك! سنقوم بالرد عليك في أقرب وقت ممكن. يمكنك كتابة "مساعدة" لعرض القائمة.'
) ON CONFLICT (phone_number_id) DO NOTHING;

INSERT INTO public.auto_reply_rules (tenant_id, keyword, match_type, reply_type, reply_content, priority, is_active)
VALUES 
(
    'a0000000-0000-0000-0000-000000000001',
    'خدماتنا,services,خدمات',
    'contains',
    'interactive_buttons',
    '{
        "body": "نقدم في Power of Media حلولاً تسويقية ورقمية متكاملة:\n\n1. إدارة الحملات الإعلانية 📢\n2. إنتاج الفيديو والمحتوى الإبداعي 🎥\n3. تطوير البرمجيات وحلول الواتساب الذكية 💻\n\nاضغط على الزر أدناه لمعرفة التفاصيل:",
        "buttons": [
            {"id": "btn_ads", "title": "📢 الحملات الإعلانية"},
            {"id": "btn_video", "title": "🎥 إنتاج الفيديو"},
            {"id": "btn_tech", "title": "💻 الحلول البرمجية"}
        ]
    }'::jsonb,
    10,
    true
),
(
    'a0000000-0000-0000-0000-000000000001',
    'اسعار,باقات,prices,pricing',
    'contains',
    'text',
    '{
        "body": "للاطلاع على باقات وخطط الأسعار المخصصة لشركتك، يرجى تزويدنا بتفاصيل مشروعك أو زيارة موقعنا الإلكتروني.\nفريق المبيعات متاح الآن لمساعدتك! 💼📞"
    }'::jsonb,
    5,
    true
) ON CONFLICT DO NOTHING;
