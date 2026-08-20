const axios = require('axios');
const env = require('../config/env');

class MetaService {
  constructor() {
    this.apiVersion = env.META_GRAPH_API_VERSION || 'v21.0';
    this.baseUrl = 'https://graph.facebook.com';
  }

  /**
   * Validate WhatsApp Phone Number ID and Permanent Access Token
   * by calling Meta Graph API.
   * @param {string} phoneNumberId 
   * @param {string} accessToken 
   * @returns {Promise<{valid: boolean, data?: object, error?: string}>}
   */
  async validateCredentials(phoneNumberId, accessToken) {
    if (!phoneNumberId || !accessToken) {
      return { valid: false, error: 'Phone Number ID and Access Token are required.' };
    }

    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${phoneNumberId.trim()}`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`
        },
        params: {
          fields: 'display_phone_number,verified_name,quality_rating,code_verification_status,name_status,platform_type'
        },
        timeout: 10000
      });

      return {
        valid: true,
        data: response.data
      };
    } catch (error) {
      const errorData = error.response?.data?.error;
      const errorMsg = errorData?.message || error.message || 'Failed to validate WhatsApp credentials.';
      const errorCode = errorData?.code || 'UNKNOWN';

      console.error(`[MetaService] Credential validation failed: [${errorCode}] ${errorMsg}`);
      return {
        valid: false,
        error: errorMsg,
        code: errorCode,
        details: errorData
      };
    }
  }

  /**
   * Send WhatsApp message via Meta Cloud API using tenant's isolated credentials.
   * @param {string} phoneNumberId 
   * @param {string} accessToken 
   * @param {object} payload 
   * @returns {Promise<object>}
   */
  async sendRawMessage(phoneNumberId, accessToken, payload) {
    const url = `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`;
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      return { success: true, data: response.data };
    } catch (error) {
      const errorData = error.response?.data?.error;
      console.error(`[MetaService] Error sending message to ${payload.to}:`, errorData || error.message);
      return {
        success: false,
        error: errorData?.message || error.message,
        details: errorData
      };
    }
  }

  /**
   * Send a standard text message.
   */
  async sendTextMessage(phoneNumberId, accessToken, toPhone, text) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'text',
      text: {
        preview_url: true,
        body: text
      }
    };
    return this.sendRawMessage(phoneNumberId, accessToken, payload);
  }

  /**
   * Send Interactive Buttons (up to 3 buttons).
   */
  async sendInteractiveButtons(phoneNumberId, accessToken, toPhone, bodyText, buttons = [], headerText = null, footerText = null) {
    const formattedButtons = buttons.slice(0, 3).map((btn, index) => ({
      type: 'reply',
      reply: {
        id: btn.id || `btn_${index + 1}`,
        title: (btn.title || btn.text || `Option ${index + 1}`).substring(0, 20)
      }
    }));

    const interactiveObj = {
      type: 'button',
      body: {
        text: bodyText
      },
      action: {
        buttons: formattedButtons
      }
    };

    if (headerText) {
      interactiveObj.header = {
        type: 'text',
        text: headerText
      };
    }

    if (footerText) {
      interactiveObj.footer = {
        text: footerText
      };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'interactive',
      interactive: interactiveObj
    };

    return this.sendRawMessage(phoneNumberId, accessToken, payload);
  }

  /**
   * Send Interactive List message.
   */
  async sendInteractiveList(phoneNumberId, accessToken, toPhone, bodyText, buttonTitle = 'اختر من القائمة', sections = [], headerText = null, footerText = null) {
    const interactiveObj = {
      type: 'list',
      body: {
        text: bodyText
      },
      action: {
        button: (buttonTitle || 'القائمة').substring(0, 20),
        sections: sections
      }
    };

    if (headerText) {
      interactiveObj.header = {
        type: 'text',
        text: headerText
      };
    }

    if (footerText) {
      interactiveObj.footer = {
        text: footerText
      };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'interactive',
      interactive: interactiveObj
    };

    return this.sendRawMessage(phoneNumberId, accessToken, payload);
  }

  /**
   * Send Media (image, document, video, audio) with optional caption.
   */
  async sendMediaMessage(phoneNumberId, accessToken, toPhone, mediaType, mediaUrl, caption = '') {
    const validMediaTypes = ['image', 'document', 'video', 'audio'];
    const type = validMediaTypes.includes(mediaType) ? mediaType : 'image';

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: type,
      [type]: {
        link: mediaUrl,
        ...(caption && type !== 'audio' ? { caption } : {})
      }
    };

    return this.sendRawMessage(phoneNumberId, accessToken, payload);
  }

  /**
   * Mark incoming WhatsApp message as read (shows blue double checkmark).
   */
  async markMessageAsRead(phoneNumberId, accessToken, messageId) {
    if (!messageId) return;
    try {
      await axios.post(
        `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );
    } catch (err) {
      // Non-critical operation, log silently
      console.warn(`[MetaService] Could not mark message ${messageId} as read:`, err.message);
    }
  }
}

module.exports = new MetaService();
