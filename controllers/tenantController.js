const tenantService = require('../services/tenantService');
const metaService = require('../services/metaService');

class TenantController {
  async listTenants(req, res) {
    try {
      const tenants = await tenantService.getAllTenants();
      // Mask access tokens for safe API responses
      const safeTenants = tenants.map(t => ({
        ...t,
        access_token_masked: t.access_token 
          ? `${t.access_token.substring(0, 8)}...${t.access_token.substring(t.access_token.length - 6)}`
          : ''
      }));
      return res.json({ success: true, data: safeTenants });
    } catch (error) {
      console.error('[TenantController] listTenants error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getTenant(req, res) {
    try {
      const { id } = req.params;
      const tenant = await tenantService.getTenantById(id);
      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Client not found.' });
      }
      return res.json({ success: true, data: tenant });
    } catch (error) {
      console.error('[TenantController] getTenant error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async createTenant(req, res) {
    try {
      const { name, phone_number_id, waba_id, access_token, verify_token, welcome_reply, default_fallback_reply, enable_welcome, enable_fallback } = req.body;

      if (!name || !phone_number_id || !access_token) {
        return res.status(400).json({
          success: false,
          error: 'Company Name, WhatsApp Phone Number ID, and Permanent Access Token are required.'
        });
      }

      const tenant = await tenantService.createTenant({
        name,
        phone_number_id,
        waba_id,
        access_token,
        verify_token,
        welcome_reply,
        default_fallback_reply,
        enable_welcome,
        enable_fallback
      });

      console.log(`[TenantController] New tenant registered successfully: ${tenant.name} (${tenant.phone_number_id})`);
      return res.status(201).json({ success: true, data: tenant });
    } catch (error) {
      console.error('[TenantController] createTenant error:', error.message);
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateTenant(req, res) {
    try {
      const { id } = req.params;
      const updated = await tenantService.updateTenant(id, req.body);
      return res.json({ success: true, data: updated });
    } catch (error) {
      console.error('[TenantController] updateTenant error:', error.message);
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteTenant(req, res) {
    try {
      const { id } = req.params;
      await tenantService.deleteTenant(id);
      return res.json({ success: true, message: 'Client deleted successfully.' });
    } catch (error) {
      console.error('[TenantController] deleteTenant error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Automated Onboarding & Token Validator
   * Tests Phone Number ID and Access Token against Meta Graph API
   */
  async validateMetaCredentials(req, res) {
    try {
      const { phone_number_id, access_token } = req.body;
      if (!phone_number_id || !access_token) {
        return res.status(400).json({
          success: false,
          error: 'Phone Number ID and Access Token are required for validation.'
        });
      }

      const result = await metaService.validateCredentials(phone_number_id, access_token);
      return res.json(result);
    } catch (error) {
      console.error('[TenantController] validateMetaCredentials error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new TenantController();
