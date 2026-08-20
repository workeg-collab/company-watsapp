const tenantService = require('../services/tenantService');
const metaService = require('../services/metaService');

class ChatController {
  async getConversations(req, res) {
    try {
      const { tenantId } = req.params;
      const conversations = await tenantService.getConversations(tenantId);
      return res.json({ success: true, data: conversations });
    } catch (error) {
      console.error('[ChatController] getConversations error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getMessages(req, res) {
    try {
      const { tenantId, phone } = req.params;
      const messages = await tenantService.getConversationMessages(tenantId, phone);
      return res.json({ success: true, data: messages });
    } catch (error) {
      console.error('[ChatController] getMessages error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async sendManualReply(req, res) {
    try {
      const { tenantId, phone } = req.params;
      const { message_body } = req.body;

      if (!message_body || !message_body.trim()) {
        return res.status(400).json({ success: false, error: 'Message body cannot be empty.' });
      }

      const tenant = await tenantService.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found.' });
      }

      const cleanPhone = String(phone).replace(/\D/g, '');

      // Send outbound message via Meta Cloud API
      const result = await metaService.sendTextMessage(
        tenant.phone_number_id,
        tenant.access_token,
        cleanPhone,
        message_body.trim()
      );

      const status = result.success ? 'manual_sent' : 'failed';

      // Log the outbound manual message
      const logEntry = await tenantService.logMessage({
        tenant_id: tenant.id,
        phone_number_id: tenant.phone_number_id,
        direction: 'outbound',
        sender_phone: tenant.phone_number_id,
        recipient_phone: cleanPhone,
        message_body: message_body.trim(),
        message_type: 'text',
        response_body: message_body.trim(),
        status: status,
        error_message: result.error || null
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || 'Failed to send message via WhatsApp Meta API.',
          details: result.details
        });
      }

      return res.json({
        success: true,
        message: 'Message sent successfully.',
        data: logEntry
      });
    } catch (error) {
      console.error('[ChatController] sendManualReply error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ChatController();
