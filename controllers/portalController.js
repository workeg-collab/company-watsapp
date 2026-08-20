const tenantService = require('../services/tenantService');
const metaService = require('../services/metaService');

class PortalController {
  /**
   * Authenticate client portal by Tenant ID / Portal Key + Portal PIN
   */
  async authenticate(req, res) {
    try {
      const { identifier, pin } = req.body;
      if (!identifier || !pin) {
        return res.status(400).json({ success: false, error: 'Identifier and PIN are required.' });
      }

      const tenant = await tenantService.authenticatePortal(identifier, pin);
      if (!tenant) {
        return res.status(401).json({ success: false, error: 'رمز الدخول أو معرّف الشركة غير صحيح.' });
      }

      return res.json({
        success: true,
        data: {
          id: tenant.id,
          name: tenant.name,
          phone_number_id: tenant.phone_number_id,
          portal_key: tenant.portal_key,
          status: tenant.status
        }
      });
    } catch (error) {
      console.error('[PortalController] authenticate error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get full isolated workspace data for a client
   */
  async getPortalWorkspace(req, res) {
    try {
      const { tenantId } = req.params;
      const tenant = await tenantService.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found.' });
      }

      const [rules, contacts, logs, stats] = await Promise.all([
        tenantService.getRulesByTenantId(tenantId),
        tenantService.getContactsByTenantId(tenantId),
        tenantService.getLogs({ tenant_id: tenantId, limit: 30 }),
        tenantService.getStats(tenantId)
      ]);

      return res.json({
        success: true,
        data: {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            phone_number_id: tenant.phone_number_id,
            waba_id: tenant.waba_id,
            portal_key: tenant.portal_key,
            portal_pin: tenant.portal_pin,
            status: tenant.status,
            enable_welcome: tenant.enable_welcome,
            welcome_reply: tenant.welcome_reply,
            enable_fallback: tenant.enable_fallback,
            default_fallback_reply: tenant.default_fallback_reply,
            business_hours: tenant.business_hours
          },
          stats,
          rules,
          contacts,
          recentLogs: logs
        }
      });
    } catch (error) {
      console.error('[PortalController] getPortalWorkspace error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Client updates their own business profile & automation settings
   */
  async updatePortalSettings(req, res) {
    try {
      const { tenantId } = req.params;
      const { name, welcome_reply, default_fallback_reply, enable_welcome, enable_fallback, business_hours } = req.body;

      const updated = await tenantService.updateTenant(tenantId, {
        ...(name ? { name } : {}),
        welcome_reply,
        default_fallback_reply,
        enable_welcome: enable_welcome !== undefined ? Boolean(enable_welcome) : true,
        enable_fallback: enable_fallback !== undefined ? Boolean(enable_fallback) : true,
        business_hours
      });

      return res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح.', data: updated });
    } catch (error) {
      console.error('[PortalController] updatePortalSettings error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new PortalController();
