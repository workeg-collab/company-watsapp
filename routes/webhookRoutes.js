const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Verification endpoint for Meta Webhook setup
router.get('/', (req, res) => webhookController.verify(req, res));

// Incoming WhatsApp event processor
router.post('/', (req, res) => webhookController.handleEvent(req, res));

module.exports = router;
