const express = require('express');
const router = express.Router();

const tenantController = require('../controllers/tenantController');
const ruleController = require('../controllers/ruleController');
const logController = require('../controllers/logController');
const simulatorController = require('../controllers/simulatorController');
const env = require('../config/env');

// Optional API Key middleware
const apiKeyAuth = (req, res, next) => {
  if (!env.ADMIN_API_KEY) return next();
  const providedKey = req.headers['x-api-key'] || req.query.apiKey;
  if (providedKey === env.ADMIN_API_KEY) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key.' });
};

// ==========================================
// System & Health
// ==========================================
router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    databaseConfigured: env.isSupabaseConfigured,
    metaApiVersion: env.META_GRAPH_API_VERSION
  });
});

// Stats
router.get('/stats', (req, res) => logController.getStats(req, res));

// ==========================================
// Tenants
// ==========================================
router.get('/tenants', (req, res) => tenantController.listTenants(req, res));
router.get('/tenants/:id', (req, res) => tenantController.getTenant(req, res));
router.post('/tenants', (req, res) => tenantController.createTenant(req, res));
router.put('/tenants/:id', (req, res) => tenantController.updateTenant(req, res));
router.delete('/tenants/:id', (req, res) => tenantController.deleteTenant(req, res));

// Automated Onboarding: Meta Credential Validator
router.post('/tenants/validate-credentials', (req, res) => tenantController.validateMetaCredentials(req, res));

// ==========================================
// Auto-Reply Rules per Tenant
// ==========================================
router.get('/tenants/:tenantId/rules', (req, res) => ruleController.listRules(req, res));
router.post('/tenants/:tenantId/rules', (req, res) => ruleController.createRule(req, res));
router.put('/rules/:ruleId', (req, res) => ruleController.updateRule(req, res));
router.delete('/rules/:ruleId', (req, res) => ruleController.deleteRule(req, res));

// ==========================================
// Logs & Audit Trail
// ==========================================
router.get('/logs', (req, res) => logController.getLogs(req, res));

// ==========================================
// WhatsApp Chat Simulator
// ==========================================
router.post('/simulate', (req, res) => simulatorController.simulateMessage(req, res));

module.exports = router;
