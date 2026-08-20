const tenantService = require('../services/tenantService');
const ruleEngine = require('../services/ruleEngine');

class SimulatorController {
  async simulateMessage(req, res) {
    try {
      const { tenant_id, message_text, sender_phone, sender_name, button_id } = req.body;

      if (!tenant_id) {
        return res.status(400).json({ success: false, error: 'tenant_id is required' });
      }

      const tenant = await tenantService.getTenantById(tenant_id);
      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      const rules = await tenantService.getActiveRulesForTenant(tenant_id);

      const parsedMessage = {
        messageId: `sim_${Date.now()}`,
        senderPhone: sender_phone || '201000000000',
        senderName: sender_name || 'عميل تجريبي',
        type: button_id ? 'interactive' : 'text',
        text: message_text || '',
        buttonId: button_id || null,
        listId: null
      };

      const evaluation = ruleEngine.evaluate(parsedMessage, tenant, rules);

      return res.json({
        success: true,
        data: {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            phone_number_id: tenant.phone_number_id
          },
          inputMessage: parsedMessage,
          evaluation: {
            matched: evaluation.matched,
            matchReason: evaluation.matchReason,
            replyType: evaluation.replyType,
            replyContent: evaluation.replyContent,
            matchedRule: evaluation.rule ? {
              id: evaluation.rule.id,
              keyword: evaluation.rule.keyword,
              match_type: evaluation.rule.match_type
            } : null
          }
        }
      });
    } catch (error) {
      console.error('[SimulatorController] Simulation error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new SimulatorController();
