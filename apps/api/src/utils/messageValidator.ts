export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: any;
}

/**
 * Message validator and sanitizer for WebSocket messages
 * Prevents XSS, injection attacks, and malformed data
 */
export class MessageValidator {
  private static readonly MAX_NAME_LENGTH = 50;
  private static readonly MAX_MESSAGE_SIZE = 10000; // 10KB
  private static readonly ALLOWED_TYPES = [
    'join',
    'leave',
    'cancel',
    'message',
    'typing',
    'signal',
    'ping',
  ];

  /**
   * Validate and sanitize incoming WebSocket message
   */
  public static validate(rawMessage: string): ValidationResult {
    // Check message size
    if (rawMessage.length > this.MAX_MESSAGE_SIZE) {
      return {
        valid: false,
        error: 'Message too large',
      };
    }

    // Parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(rawMessage);
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid JSON',
      };
    }

    // Check required fields
    if (!parsed || typeof parsed !== 'object') {
      return {
        valid: false,
        error: 'Message must be an object',
      };
    }

    if (!parsed.type || typeof parsed.type !== 'string') {
      return {
        valid: false,
        error: 'Missing or invalid type field',
      };
    }

    // Check allowed type
    if (!this.ALLOWED_TYPES.includes(parsed.type)) {
      return {
        valid: false,
        error: `Invalid message type: ${parsed.type}`,
      };
    }

    // Validate based on type
    switch (parsed.type) {
      case 'join':
        return this.validateJoin(parsed);
      case 'message':
        return this.validateChatMessage(parsed);
      case 'typing':
        return this.validateTypingIndicator(parsed);
      case 'signal':
        return this.validateSignal(parsed);
      case 'ping':
      case 'leave':
      case 'cancel':
        return { valid: true, sanitized: parsed };
      default:
        return { valid: true, sanitized: parsed };
    }
  }

  private static validateJoin(msg: any): ValidationResult {
    const sanitized: any = { type: 'join', data: {} };

    // Check data object exists
    if (!msg.data || typeof msg.data !== 'object') {
      return { valid: false, error: 'Missing or invalid data' };
    }

    // Validate UID
    if (!this.isValidUID(msg.data.uid)) {
      return { valid: false, error: 'Missing or invalid UID' };
    }
    sanitized.data.uid = msg.data.uid;

    // Validate name
    if (!msg.data.name || typeof msg.data.name !== 'string') {
      return { valid: false, error: 'Missing or invalid name' };
    }
    sanitized.data.name = this.sanitizeString(msg.data.name, this.MAX_NAME_LENGTH);

    // Validate gender
    if (!msg.data.gender || !['male', 'female'].includes(msg.data.gender)) {
      return { valid: false, error: 'Invalid gender (must be male or female)' };
    }
    sanitized.data.gender = msg.data.gender;

    return { valid: true, sanitized };
  }

  private static validateAuth(msg: any): ValidationResult {
    const sanitized: any = { type: 'auth' };

    // Validate name
    if (!msg.name || typeof msg.name !== 'string') {
      return { valid: false, error: 'Missing or invalid name' };
    }
    sanitized.name = this.sanitizeString(msg.name, this.MAX_NAME_LENGTH);

    // Validate gender
    if (!msg.gender || !['male', 'female'].includes(msg.gender)) {
      return { valid: false, error: 'Invalid gender (must be male or female)' };
    }
    sanitized.gender = msg.gender;

    return { valid: true, sanitized };
  }

  private static validateSearch(msg: any): ValidationResult {
    const sanitized: any = { type: 'search' };

    // Optional interest validation
    if (msg.interest) {
      if (typeof msg.interest !== 'string') {
        return { valid: false, error: 'Interest must be a string' };
      }
      sanitized.interest = this.sanitizeString(msg.interest, 100);
    }

    return { valid: true, sanitized };
  }

  private static validateChatMessage(msg: any): ValidationResult {
    const sanitized: any = { type: 'message', data: {} };

    // Validate text in data object
    if (!msg.data?.text || typeof msg.data.text !== 'string') {
      return { valid: false, error: 'Missing or invalid message text' };
    }

    if (msg.data.text.length > 1000) {
      return { valid: false, error: 'Message too long (max 1000 chars)' };
    }

    sanitized.data.text = this.sanitizeString(msg.data.text, 1000);

    return { valid: true, sanitized };
  }

  private static validateTypingIndicator(msg: any): ValidationResult {
    const result = {
      valid: true,
      sanitized: {
        type: 'typing',
        data: { isTyping: !!msg.data?.isTyping },
      },
    };
    return result;
  }

  private static validateSignal(msg: any): ValidationResult {
    const sanitized: any = { type: 'signal' };

    // Validate signal data (for WebRTC)
    if (!msg.data || typeof msg.data !== 'object') {
      return { valid: false, error: 'Missing or invalid signal data' };
    }

    // Basic WebRTC signal validation
    const data = msg.data;
    if (data.type && !['offer', 'answer', 'candidate'].includes(data.type)) {
      return { valid: false, error: 'Invalid signal type' };
    }

    sanitized.data = data;

    return { valid: true, sanitized };
  }

  /**
   * Sanitize string - strip control/formatting characters, trim, enforce length.
   *
   * Stripping `<` and `>` is not XSS protection on its own (the clients must still escape on
   * render); it is defence in depth. The important removals here are C0/C1 control codes,
   * bidirectional-override characters, and zero-width joiners, which are used to spoof
   * display names, forge log lines, and smuggle terminal escape sequences into our logs.
   */
  private static sanitizeString(str: string, maxLength: number): string {
    if (!str) return '';

    return (
      str
        .normalize('NFC')
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // C0 and C1 control characters
        .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '') // zero-width + bidi
        .replace(/[<>]/g, '')
        .trim()
        .substring(0, maxLength)
    );
  }

  /**
   * Sanitize a user-chosen display name. Collapses runs of whitespace so a name cannot be
   * padded out to imitate another user or break dashboard layout.
   */
  public static sanitizeDisplayName(str: string, maxLength: number = this.MAX_NAME_LENGTH): string {
    if (typeof str !== 'string') return '';
    return this.sanitizeString(str, maxLength).replace(/\s+/g, ' ').trim();
  }

  /**
   * Validate UID format
   */
  public static isValidUID(uid: any): boolean {
    return typeof uid === 'number' && uid > 0 && Number.isInteger(uid);
  }

  /**
   * Validate room ID format
   */
  public static isValidRoomId(roomId: any): boolean {
    return typeof roomId === 'string' && /^[a-zA-Z0-9-_]{20,40}$/.test(roomId);
  }
}
