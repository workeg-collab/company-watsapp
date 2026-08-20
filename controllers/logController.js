const tenantService = require('../services/tenantService');

class LogController {
  async getLogs(req, res) {
    try {
      const { tenant_id, status, phone_number_id, limit } = req.query;
      const logs = await tenantService.getLogs({
        tenant_id,
        status,
        phone_number_id,
        limit
      });
      return res.json({ success: true, data: logs });
    } catch (error) {
      console.error('[LogController] getLogs error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getStats(req, res) {
    try {
      const stats = await tenantService.getStats();
      return res.json({ success: true, data: stats });
    } catch (error) {
      console.error('[LogController] getStats error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new LogController();
