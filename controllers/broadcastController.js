const tenantService = require('../services/tenantService');
const metaService = require('../services/metaService');

class BroadcastController {
  async sendBroadcast(req, res) {
    try {
      const { tenantId } = req.params;
      const { campaign_name, message_body, recipient_phones, target_tag } = req.body;

      if (!message_body || !message_body.trim()) {
        return res.status(400).json({ success: false, error: 'نص الرسالة مطلوب.' });
      }

      const tenant = await tenantService.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, error: 'الشركة غير موجودة.' });
      }

      // Collect recipient phone numbers
      let phones = [];
      if (Array.isArray(recipient_phones) && recipient_phones.length > 0) {
        phones = recipient_phones.map(p => String(p).replace(/\D/g, '')).filter(Boolean);
      } else {
        const contacts = await tenantService.getContactsByTenantId(tenantId);
        if (target_tag) {
          phones = contacts
            .filter(c => c.tags && c.tags.includes(target_tag))
            .map(c => c.phone_number);
        } else {
          phones = contacts.map(c => c.phone_number);
        }
      }

      if (phones.length === 0) {
        return res.status(400).json({ success: false, error: 'لا يوجد جهات اتصال مستهدفة في هذه الحملة.' });
      }

      let successCount = 0;
      let failedCount = 0;

      // Dispatch messages sequentially or asynchronously with slight delay to comply with Meta rate limits
      for (const phone of phones) {
        try {
          const result = await metaService.sendTextMessage(
            tenant.phone_number_id,
            tenant.access_token,
            phone,
            message_body.trim()
          );

          const status = result.success ? 'broadcast_sent' : 'failed';
          if (result.success) successCount++;
          else failedCount++;

          await tenantService.logMessage({
            tenant_id: tenant.id,
            phone_number_id: tenant.phone_number_id,
            direction: 'outbound',
            sender_phone: tenant.phone_number_id,
            recipient_phone: phone,
            message_body: message_body.trim(),
            message_type: 'text',
            response_body: message_body.trim(),
            status: status,
            error_message: result.error || null
          });
        } catch (e) {
          failedCount++;
        }
      }

      const campaign = await tenantService.createBroadcastCampaign(tenantId, {
        name: campaign_name || `حملة ${new Date().toLocaleDateString('ar-EG')}`,
        message_body: message_body.trim(),
        target_type: target_tag || 'all_contacts',
        total_recipients: phones.length,
        success_count: successCount,
        failed_count: failedCount,
        status: 'completed'
      });

      return res.json({
        success: true,
        message: `تم إرسال الحملة بنجاح إلى ${successCount} عميل (فشل ${failedCount}).`,
        data: campaign
      });
    } catch (error) {
      console.error('[BroadcastController] sendBroadcast error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async listBroadcasts(req, res) {
    try {
      const { tenantId } = req.params;
      const campaigns = await tenantService.getBroadcastCampaigns(tenantId);
      return res.json({ success: true, data: campaigns });
    } catch (error) {
      console.error('[BroadcastController] listBroadcasts error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new BroadcastController();
