const express = require('express');
const router = express.Router();

const tenantController = require('../controllers/tenantController');
const ruleController = require('../controllers/ruleController');
const logController = require('../controllers/logController');
const simulatorController = require('../controllers/simulatorController');
const chatController = require('../controllers/chatController');
const portalController = require('../controllers/portalController');
const contactController = require('../controllers/contactController');
const broadcastController = require('../controllers/broadcastController');
const env = require('../config/env');

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

router.get('/stats', (req, res) => logController.getStats(req, res));

// ==========================================
// Tenants CRUD & Credential Validator
// ==========================================
router.get('/tenants', (req, res) => tenantController.listTenants(req, res));
router.get('/tenants/:id', (req, res) => tenantController.getTenant(req, res));
router.post('/tenants', (req, res) => tenantController.createTenant(req, res));
router.put('/tenants/:id', (req, res) => tenantController.updateTenant(req, res));
router.delete('/tenants/:id', (req, res) => tenantController.deleteTenant(req, res));
router.post('/tenants/validate-credentials', (req, res) => tenantController.validateMetaCredentials(req, res));

// ==========================================
// Auto-Reply Rules per Tenant
// ==========================================
router.get('/tenants/:tenantId/rules', (req, res) => ruleController.listRules(req, res));
router.post('/tenants/:tenantId/rules', (req, res) => ruleController.createRule(req, res));
router.put('/rules/:ruleId', (req, res) => ruleController.updateRule(req, res));
router.delete('/rules/:ruleId', (req, res) => ruleController.deleteRule(req, res));

// ==========================================
// Live Chat & Inbox
// ==========================================
router.get('/tenants/:tenantId/conversations', (req, res) => chatController.getConversations(req, res));
router.get('/tenants/:tenantId/conversations/:phone/messages', (req, res) => chatController.getMessages(req, res));
router.post('/tenants/:tenantId/conversations/:phone/reply', (req, res) => chatController.sendManualReply(req, res));

// ==========================================
// Contacts Directory & Tags
// ==========================================
router.get('/tenants/:tenantId/contacts', (req, res) => contactController.listContacts(req, res));
router.put('/contacts/:contactId/tags', (req, res) => contactController.updateTags(req, res));

// ==========================================
// WhatsApp Broadcast Campaigns
// ==========================================
router.post('/tenants/:tenantId/broadcast', (req, res) => broadcastController.sendBroadcast(req, res));
router.get('/tenants/:tenantId/broadcasts', (req, res) => broadcastController.listBroadcasts(req, res));

// ==========================================
// Client Self-Service Portal
// ==========================================
router.post('/portal/auth', (req, res) => portalController.authenticate(req, res));
router.get('/portal/:tenantId', (req, res) => portalController.getPortalWorkspace(req, res));
router.put('/portal/:tenantId/settings', (req, res) => portalController.updatePortalSettings(req, res));

// ==========================================
// Logs & Simulator
// ==========================================
router.get('/logs', (req, res) => logController.getLogs(req, res));
router.post('/simulate', (req, res) => simulatorController.simulateMessage(req, res));

module.exports = router;
