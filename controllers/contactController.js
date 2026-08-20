const tenantService = require('../services/tenantService');

class ContactController {
  async listContacts(req, res) {
    try {
      const { tenantId } = req.params;
      const contacts = await tenantService.getContactsByTenantId(tenantId);
      return res.json({ success: true, data: contacts });
    } catch (error) {
      console.error('[ContactController] listContacts error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateTags(req, res) {
    try {
      const { contactId } = req.params;
      const { tags } = req.body;
      const updated = await tenantService.updateContactTags(contactId, tags);
      return res.json({ success: true, data: updated });
    } catch (error) {
      console.error('[ContactController] updateTags error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ContactController();
