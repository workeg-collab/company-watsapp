class RuleEngine {
  /**
   * Evaluate incoming message against tenant's configured rules.
   * @param {object} parsedMessage 
   * @param {object} tenant 
   * @param {Array} rules 
   * @returns {object} { matched: boolean, rule?: object, replyType: string, replyContent: object, matchReason: string }
   */
  evaluate(parsedMessage, tenant, rules = []) {
    const rawText = (parsedMessage.text || '').trim();
    const cleanText = rawText.toLowerCase();
    const payloadId = parsedMessage.buttonId || parsedMessage.listId || '';

    // 1. Check Interactive Button or List Payload matches
    if (payloadId) {
      for (const rule of rules) {
        if (!rule.is_active) continue;

        // Direct payload match
        if (rule.keyword === payloadId || rule.keyword.split(',').map(k => k.trim()).includes(payloadId)) {
          return {
            matched: true,
            rule,
            replyType: rule.reply_type || 'text',
            replyContent: this.formatReply(rule.reply_content, tenant, parsedMessage),
            matchReason: `Interactive payload match: ${payloadId}`
          };
        }
      }
    }

    // 2. Check Keyword Matching in Order of Priority
    for (const rule of rules) {
      if (!rule.is_active) continue;

      const keywords = (rule.keyword || '')
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(Boolean);

      const matchType = rule.match_type || 'contains';
      let isMatch = false;

      switch (matchType) {
        case 'exact':
          isMatch = keywords.some(k => cleanText === k);
          break;

        case 'startsWith':
          isMatch = keywords.some(k => cleanText.startsWith(k));
          break;

        case 'regex':
          try {
            const regex = new RegExp(rule.keyword, 'i');
            isMatch = regex.test(rawText);
          } catch (e) {
            console.error(`[RuleEngine] Invalid regex pattern "${rule.keyword}":`, e.message);
          }
          break;

        case 'contains':
        default:
          isMatch = keywords.some(k => cleanText.includes(k));
          break;
      }

      if (isMatch) {
        return {
          matched: true,
          rule,
          replyType: rule.reply_type || 'text',
          replyContent: this.formatReply(rule.reply_content, tenant, parsedMessage),
          matchReason: `Rule match (${matchType}): ${rule.keyword}`
        };
      }
    }

    // 3. Check for standard greetings for Welcome Message
    const commonGreetings = ['مرحبا', 'مرحباً', 'سلام', 'السلام عليكم', 'الو', 'هلا', 'أهلاً', 'اهلاً', 'hi', 'hello', 'hey', 'start', 'menu', 'قائمة'];
    const isGreeting = commonGreetings.some(g => cleanText === g || cleanText.startsWith(g));

    if (isGreeting && tenant.enable_welcome && tenant.welcome_reply) {
      const welcomeText = this.replacePlaceholders(tenant.welcome_reply, tenant, parsedMessage);
      return {
        matched: true,
        rule: null,
        replyType: 'text',
        replyContent: { body: welcomeText },
        matchReason: 'Welcome greeting matched'
      };
    }

    // 4. Check for Fallback Message
    if (tenant.enable_fallback && tenant.default_fallback_reply) {
      const fallbackText = this.replacePlaceholders(tenant.default_fallback_reply, tenant, parsedMessage);
      return {
        matched: true,
        rule: null,
        replyType: 'text',
        replyContent: { body: fallbackText },
        matchReason: 'Fallback response triggered'
      };
    }

    // 5. No match found & fallback disabled
    return {
      matched: false,
      rule: null,
      replyType: 'none',
      replyContent: null,
      matchReason: 'No matching rule and fallback is disabled'
    };
  }

  /**
   * Helper to format reply content and inject variables.
   */
  formatReply(content, tenant, message) {
    if (!content) return { body: '' };

    let parsed = content;
    if (typeof content === 'string') {
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        parsed = { body: content };
      }
    }

    if (parsed.body) {
      parsed.body = this.replacePlaceholders(parsed.body, tenant, message);
    }
    if (parsed.header) {
      parsed.header = this.replacePlaceholders(parsed.header, tenant, message);
    }
    if (parsed.footer) {
      parsed.footer = this.replacePlaceholders(parsed.footer, tenant, message);
    }

    return parsed;
  }

  /**
   * Replace dynamic placeholders like {company_name}, {sender_name}, {sender_phone}
   */
  replacePlaceholders(text, tenant, message) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/{company_name}/gi, tenant.name || 'Company')
      .replace(/{sender_name}/gi, message.senderName || 'عزيزي العميل')
      .replace(/{sender_phone}/gi, message.senderPhone || '');
  }
}

module.exports = new RuleEngine();
