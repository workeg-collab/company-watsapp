const env = require('../config/env');
const tenantService = require('../services/tenantService');
const metaService = require('../services/metaService');
const ruleEngine = require('../services/ruleEngine');

class WebhookController {
  /**
   * Handle Webhook Verification (GET /api/webhook or GET /webhook)
   */
  async verify(req, res) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      console.log(`[Webhook Verification] Request received: mode=${mode}, token=${token}`);

      if (mode === 'subscribe') {
        // 1. Check against central verify token
        if (token === env.META_VERIFY_TOKEN) {
          console.log('[Webhook Verification] Verified successfully with Central Token.');
          return res.status(200).send(challenge);
        }

        // 2. Also check if any active tenant has a matching custom verify token
        const tenants = await tenantService.getAllTenants();
        const matchingTenant = tenants.find(t => t.verify_token && t.verify_token === token);

        if (matchingTenant) {
          console.log(`[Webhook Verification] Verified successfully for tenant: ${matchingTenant.name}`);
          return res.status(200).send(challenge);
        }
      }

      console.warn('[Webhook Verification] Verification failed: Token mismatch.');
      return res.status(403).send('Verification token mismatch.');
    } catch (error) {
      console.error('[Webhook Verification] Internal error during verification:', error.message);
      return res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle Incoming Webhook Events from Meta (POST /api/webhook or POST /webhook)
   */
  async handleEvent(req, res) {
    // Crucial: Respond HTTP 200 immediately to Meta to acknowledge receipt
    res.status(200).send('EVENT_RECEIVED');

    try {
      const body = req.body;

      if (!body || body.object !== 'whatsapp_business_account') {
        return;
      }

      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== 'messages') continue;

          const value = change.value || {};
          const metadata = value.metadata || {};
          const phoneNumberId = metadata.phone_number_id;

          if (!phoneNumberId) {
            console.warn('[Webhook Router] Received webhook event without phone_number_id.');
            continue;
          }

          // Handle message delivery status updates (sent, delivered, read, failed)
          if (value.statuses && value.statuses.length > 0) {
            this.handleStatusUpdate(value.statuses[0], phoneNumberId);
            continue;
          }

          // Handle incoming messages
          const messages = value.messages || [];
          const contacts = value.contacts || [];
          const contactProfile = contacts.length > 0 ? contacts[0].profile : {};
          const senderName = contactProfile?.name || 'Customer';

          for (const message of messages) {
            await this.processIncomingMessage(phoneNumberId, message, senderName, body);
          }
        }
      }
    } catch (error) {
      console.error('[Webhook Router] Critical error processing webhook payload:', error);
    }
  }

  /**
   * Process isolated incoming message for a specific tenant
   */
  async processIncomingMessage(phoneNumberId, message, senderName, rawPayload) {
    const senderPhone = message.from;
    const messageId = message.id;
    const messageType = message.type;

    console.log(`[Webhook Router] 📨 Inbound message from ${senderPhone} to Phone ID [${phoneNumberId}] (Type: ${messageType})`);

    // 1. Dynamic Tenant Isolation Lookup
    const tenant = await tenantService.getTenantByPhoneNumberId(phoneNumberId);
    if (!tenant) {
      console.warn(`[Webhook Router] ⚠️ No active tenant found matching Phone Number ID: ${phoneNumberId}. Message ignored.`);
      await tenantService.logMessage({
        tenant_id: null,
        phone_number_id: phoneNumberId,
        direction: 'inbound',
        sender_phone: senderPhone,
        sender_name: senderName,
        message_body: `[Unregistered Phone ID] ${JSON.stringify(message)}`,
        message_type: messageType,
        status: 'ignored',
        raw_payload: rawPayload
      });
      return;
    }

    console.log(`[Webhook Router] 🏢 Tenant isolated: [${tenant.name}] (ID: ${tenant.id})`);

    // 2. Mark incoming message as read on Meta
    metaService.markMessageAsRead(phoneNumberId, tenant.access_token, messageId).catch(() => {});

    // 3. Extract Message Text & Interactive Payloads
    let parsedMessage = {
      messageId,
      senderPhone,
      senderName,
      type: messageType,
      text: '',
      buttonId: null,
      listId: null
    };

    if (messageType === 'text') {
      parsedMessage.text = message.text?.body || '';
    } else if (messageType === 'interactive') {
      const interactive = message.interactive || {};
      if (interactive.type === 'button_reply') {
        parsedMessage.buttonId = interactive.button_reply?.id;
        parsedMessage.text = interactive.button_reply?.title || '';
      } else if (interactive.type === 'list_reply') {
        parsedMessage.listId = interactive.list_reply?.id;
        parsedMessage.text = interactive.list_reply?.title || '';
      }
    } else if (messageType === 'button') {
      parsedMessage.buttonId = message.button?.payload;
      parsedMessage.text = message.button?.text || '';
    } else if (messageType === 'image' || messageType === 'document' || messageType === 'video') {
      parsedMessage.text = message[messageType]?.caption || `[${messageType.toUpperCase()}]`;
    } else {
      parsedMessage.text = `[${messageType}]`;
    }

    // 4. Load Isolated Tenant Rules
    const rules = await tenantService.getActiveRulesForTenant(tenant.id);

    // 5. Evaluate Rule Engine
    const evaluation = ruleEngine.evaluate(parsedMessage, tenant, rules);
    console.log(`[Webhook Router][${tenant.name}] 🧠 Rule Evaluation Result: ${evaluation.matchReason} (Matched: ${evaluation.matched})`);

    let replyStatus = 'received';
    let responseSummary = '';

    if (evaluation.matched && evaluation.replyContent) {
      try {
        let sendResult = null;

        if (evaluation.replyType === 'interactive_buttons' && evaluation.replyContent.buttons) {
          sendResult = await metaService.sendInteractiveButtons(
            phoneNumberId,
            tenant.access_token,
            senderPhone,
            evaluation.replyContent.body || '',
            evaluation.replyContent.buttons,
            evaluation.replyContent.header,
            evaluation.replyContent.footer
          );
          responseSummary = `[Buttons] ${evaluation.replyContent.body}`;
        } else if (evaluation.replyType === 'interactive_list' && evaluation.replyContent.sections) {
          sendResult = await metaService.sendInteractiveList(
            phoneNumberId,
            tenant.access_token,
            senderPhone,
            evaluation.replyContent.body || '',
            evaluation.replyContent.buttonTitle || 'عرض القائمة',
            evaluation.replyContent.sections,
            evaluation.replyContent.header,
            evaluation.replyContent.footer
          );
          responseSummary = `[List] ${evaluation.replyContent.body}`;
        } else if (evaluation.replyType === 'media' && evaluation.replyContent.url) {
          sendResult = await metaService.sendMediaMessage(
            phoneNumberId,
            tenant.access_token,
            senderPhone,
            evaluation.replyContent.mediaType || 'image',
            evaluation.replyContent.url,
            evaluation.replyContent.caption || ''
          );
          responseSummary = `[Media] ${evaluation.replyContent.url}`;
        } else {
          // Standard text message
          const textBody = evaluation.replyContent.body || '';
          sendResult = await metaService.sendTextMessage(
            phoneNumberId,
            tenant.access_token,
            senderPhone,
            textBody
          );
          responseSummary = textBody;
        }

        if (sendResult?.success) {
          replyStatus = evaluation.matchReason.includes('Fallback') ? 'fallback_sent' : 'replied';
          console.log(`[Webhook Router][${tenant.name}] ✅ Outbound reply sent successfully to ${senderPhone}.`);
        } else {
          replyStatus = 'failed';
          console.error(`[Webhook Router][${tenant.name}] ❌ Failed to dispatch outbound reply:`, sendResult?.error);
        }
      } catch (sendErr) {
        replyStatus = 'failed';
        console.error(`[Webhook Router][${tenant.name}] ❌ Exception sending message:`, sendErr.message);
      }
    } else {
      replyStatus = 'ignored';
    }

    // 6. Record Audit Trail / Log in Database
    await tenantService.logMessage({
      tenant_id: tenant.id,
      phone_number_id: phoneNumberId,
      direction: 'inbound',
      sender_phone: senderPhone,
      sender_name: senderName,
      message_body: parsedMessage.text,
      message_type: messageType,
      matched_rule_id: evaluation.rule?.id || null,
      response_body: responseSummary,
      status: replyStatus,
      raw_payload: rawPayload
    });
  }

  /**
   * Handle delivery receipts and status updates from Meta
   */
  handleStatusUpdate(statusObj, phoneNumberId) {
    const { id, status, recipient_id, errors } = statusObj;
    if (errors && errors.length > 0) {
      console.warn(`[Webhook Router] ⚠️ Delivery failure for message ${id} to ${recipient_id}:`, errors[0].message);
    } else {
      console.log(`[Webhook Router] ℹ️ Message status update: [${id}] -> ${status} (Recipient: ${recipient_id})`);
    }
  }
}

module.exports = new WebhookController();
