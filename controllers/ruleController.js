const tenantService = require('../services/tenantService');

class RuleController {
  async listRules(req, res) {
    try {
      const { tenantId } = req.params;
      const rules = await tenantService.getRulesByTenantId(tenantId);
      return res.json({ success: true, data: rules });
    } catch (error) {
      console.error('[RuleController] listRules error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async createRule(req, res) {
    try {
      const { tenantId } = req.params;
      const { keyword, match_type, reply_type, reply_content, priority, is_active } = req.body;

      if (!keyword || !reply_content) {
        return res.status(400).json({
          success: false,
          error: 'Keyword and reply content are required.'
        });
      }

      const rule = await tenantService.createRule(tenantId, {
        keyword,
        match_type,
        reply_type,
        reply_content,
        priority,
        is_active
      });

      return res.status(201).json({ success: true, data: rule });
    } catch (error) {
      console.error('[RuleController] createRule error:', error.message);
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateRule(req, res) {
    try {
      const { ruleId } = req.params;
      const updated = await tenantService.updateRule(ruleId, req.body);
      return res.json({ success: true, data: updated });
    } catch (error) {
      console.error('[RuleController] updateRule error:', error.message);
      return res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteRule(req, res) {
    try {
      const { ruleId } = req.params;
      await tenantService.deleteRule(ruleId);
      return res.json({ success: true, message: 'Rule deleted successfully.' });
    } catch (error) {
      console.error('[RuleController] deleteRule error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new RuleController();
