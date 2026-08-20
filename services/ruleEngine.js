class RuleEngine {
  /**
   * Evaluate incoming message against tenant's configured rules and business hours.
   */
  evaluate(parsedMessage, tenant, rules = []) {
    const rawText = (parsedMessage.text || '').trim();
    const cleanText = rawText.toLowerCase();
    const payloadId = parsedMessage.buttonId || parsedMessage.listId || '';

    // 1. Check Business Hours (if enabled)
    const isOutsideHours = this.checkIfOutsideBusinessHours(tenant.business_hours);
    if (isOutsideHours && tenant.business_hours?.off_hours_reply) {
      const offHoursText = this.replacePlaceholders(tenant.business_hours.off_hours_reply, tenant, parsedMessage);
      return {
        matched: true,
        rule: null,
        replyType: 'text',
        replyContent: { body: offHoursText },
        matchReason: 'Outside business hours auto-reply'
      };
    }

    // 2. Check Interactive Button or List Payload matches
    if (payloadId) {
      for (const rule of rules) {
        if (!rule.is_active) continue;

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

    // 3. Check Keyword Matching in Order of Priority
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

    // 4. Check for standard greetings for Welcome Message
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

    // 5. Check for Fallback Message
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

    // 6. No match
    return {
      matched: false,
      rule: null,
      replyType: 'none',
      replyContent: null,
      matchReason: 'No matching rule and fallback is disabled'
    };
  }

  /**
   * Helper to check if current time is outside tenant's configured working hours.
   */
  checkIfOutsideBusinessHours(businessHours) {
    if (!businessHours || !businessHours.enabled) return false;

    try {
      const timezone = businessHours.timezone || 'Africa/Cairo';
      const now = new Date();
      const localTimeStr = now.toLocaleTimeString('en-GB', { timeZone: timezone, hour12: false });
      const localDay = new Date(now.toLocaleString('en-US', { timeZone: timezone })).getDay();

      const workDays = businessHours.work_days || [0, 1, 2, 3, 4]; // Sunday=0, Thursday=4
      if (!workDays.includes(localDay)) {
        return true; // Weekend / Off day
      }

      const [curHour, curMin] = localTimeStr.split(':').map(Number);
      const curTotalMinutes = curHour * 60 + curMin;

      const [startHour, startMin] = (businessHours.start_time || '09:00').split(':').map(Number);
      const startTotalMinutes = startHour * 60 + startMin;

      const [endHour, endMin] = (businessHours.end_time || '18:00').split(':').map(Number);
      const endTotalMinutes = endHour * 60 + endMin;

      if (curTotalMinutes < startTotalMinutes || curTotalMinutes > endTotalMinutes) {
        return true; // Before opening or after closing
      }

      return false;
    } catch (e) {
      console.warn('[RuleEngine] Business hours calculation error:', e.message);
      return false;
    }
  }

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

    if (parsed.body) parsed.body = this.replacePlaceholders(parsed.body, tenant, message);
    if (parsed.header) parsed.header = this.replacePlaceholders(parsed.header, tenant, message);
    if (parsed.footer) parsed.footer = this.replacePlaceholders(parsed.footer, tenant, message);

    return parsed;
  }

  replacePlaceholders(text, tenant, message) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/{company_name}/gi, tenant.name || 'Company')
      .replace(/{sender_name}/gi, message.senderName || 'عزيزي العميل')
      .replace(/{sender_phone}/gi, message.senderPhone || '');
  }
}

module.exports = new RuleEngine();
