-- =========================================================================
-- Power of Media - Multi-Tenant WhatsApp Business SaaS Database Schema
-- Compatible with Supabase (PostgreSQL 14+)
-- =========================================================================

-- Enable UUID extension if not already enabled
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
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
    enable_welcome BOOLEAN DEFAULT true,
    welcome_reply TEXT DEFAULT 'مرحباً بك! يسعدنا تواصلك مع شركة {company_name}. كيف يمكننا مساعدتك اليوم؟ 🚀',
    enable_fallback BOOLEAN DEFAULT true,
    default_fallback_reply TEXT DEFAULT 'شكراً لتواصلك معنا. لم نتمكن من فهم طلبك بدقة، وسيتم تحويلك إلى أحد ممثلي خدمة العملاء قريباً. 💬',
    custom_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index for ultra-fast webhook lookup by Phone Number ID
CREATE INDEX IF NOT EXISTS idx_tenants_phone_number_id ON public.tenants (phone_number_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants (status);

-- =========================================================================
-- 2. Auto-Reply & Keyword Rules Table (Per Tenant Isolation)
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

-- Index for tenant rules lookup
CREATE INDEX IF NOT EXISTS idx_rules_tenant_id ON public.auto_reply_rules (tenant_id);
CREATE INDEX IF NOT EXISTS idx_rules_is_active ON public.auto_reply_rules (is_active);
CREATE INDEX IF NOT EXISTS idx_rules_priority ON public.auto_reply_rules (priority DESC);

-- =========================================================================
-- 3. Message Logs & Audit Trail Table (Per Tenant Isolation)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    phone_number_id VARCHAR(100) NOT NULL,
    direction VARCHAR(20) DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
    sender_phone VARCHAR(50) NOT NULL,
    sender_name VARCHAR(255),
    recipient_phone VARCHAR(50),
    message_body TEXT,
    message_type VARCHAR(50) DEFAULT 'text',
    matched_rule_id UUID REFERENCES public.auto_reply_rules(id) ON DELETE SET NULL,
    response_body TEXT,
    status VARCHAR(30) DEFAULT 'received' CHECK (status IN ('received', 'replied', 'failed', 'ignored', 'fallback_sent')),
    error_message TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for log querying & dashboard analytics
CREATE INDEX IF NOT EXISTS idx_logs_tenant_id ON public.message_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.message_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_phone_number_id ON public.message_logs (phone_number_id);
CREATE INDEX IF NOT EXISTS idx_logs_sender_phone ON public.message_logs (sender_phone);

-- =========================================================================
-- 4. Automatic updated_at Trigger
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
-- 5. Row Level Security (RLS) Policies
-- =========================================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_reply_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (Backend server uses service_role key)
DROP POLICY IF EXISTS "Service Role Full Access on Tenants" ON public.tenants;
CREATE POLICY "Service Role Full Access on Tenants" ON public.tenants
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access on Rules" ON public.auto_reply_rules;
CREATE POLICY "Service Role Full Access on Rules" ON public.auto_reply_rules
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access on Logs" ON public.message_logs;
CREATE POLICY "Service Role Full Access on Logs" ON public.message_logs
    FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- 6. Sample Initial Seed Data (Optional Demonstration)
-- =========================================================================
INSERT INTO public.tenants (id, name, phone_number_id, waba_id, access_token, status, welcome_reply, default_fallback_reply)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Power of Media Agency',
    '102938475610293',
    '987654321098765',
    'EAAG_SAMPLE_PERMANENT_TOKEN_POWER_OF_MEDIA',
    'active',
    'مرحباً بك في وكالة Power of Media! 🎬🚀 نسعد بخدمتك. اكتب "خدماتنا" أو "اسعار" لمعرفة المزيد.',
    'شكراً لرسالتك! سنقوم بالرد عليك في أقرب وقت ممكن. يمكنك كتابة "مساعدة" لعرض القائمة.'
) ON CONFLICT (phone_number_id) DO NOTHING;

-- Sample Rules for Power of Media
INSERT INTO public.auto_reply_rules (tenant_id, keyword, match_type, reply_type, reply_content, priority, is_active)
VALUES 
(
    'a0000000-0000-0000-0000-000000000001',
    'خدماتنا,services,خدمات',
    'contains',
    'interactive_buttons',
    '{
        "body": "نقدم في Power of Media حلولاً تسويقية ورقمية متكاملة:\n\n1. إدارة الحملات الإعلانية\n2. إنتاج الفيديو والمحتوى الإبداعي\n3. تطوير البرمجيات وحلول الواتساب الذكية\n\nاختر من الأزرار أدناه لمعرفة التفاصيل:",
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
),
(
    'a0000000-0000-0000-0000-000000000001',
    'موقعكم,عنوان,location,address',
    'contains',
    'text',
    '{
        "body": "📍 يسعدنا تشريفك في مقر Power of Media.\nساعات العمل: الأحد إلى الخميس من 9:00 صباحاً حتى 6:00 مساءً."
    }'::jsonb,
    5,
    true
) ON CONFLICT DO NOTHING;
