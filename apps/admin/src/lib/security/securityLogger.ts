/**
 * Security Logger
 *
 * Centralized logging for security events in the admin panel.
 * Helps track authentication attempts, security warnings, and potential threats.
 */

export enum SecurityEventType {
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILURE = "LOGIN_FAILURE",
  LOGOUT = "LOGOUT",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_INVALID = "TOKEN_INVALID",
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
  SESSION_TIMEOUT = "SESSION_TIMEOUT",
  MFA_REQUIRED = "MFA_REQUIRED",
  MFA_SUCCESS = "MFA_SUCCESS",
  MFA_FAILURE = "MFA_FAILURE",
  DEVTOOLS_DETECTED = "DEVTOOLS_DETECTED",
  TAB_HIDDEN = "TAB_HIDDEN",
  TAB_VISIBLE = "TAB_VISIBLE",
}

export enum SecurityLevel {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL",
}

interface SecurityEvent {
  type: SecurityEventType;
  level: SecurityLevel;
  timestamp: number;
  message: string;
  metadata?: Record<string, unknown>;
}

class SecurityLogger {
  private events: SecurityEvent[] = [];
  private maxEvents = 100; // Keep last 100 events in memory

  /**
   * Log a security event
   */
  log(
    type: SecurityEventType,
    level: SecurityLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    const event: SecurityEvent = {
      type,
      level,
      timestamp: Date.now(),
      message,
      metadata,
    };

    this.events.push(event);

    // Keep only the last maxEvents
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Logging disabled - events stored in memory only

    // In production, you might want to send critical events to a monitoring service
    if (
      level === SecurityLevel.CRITICAL &&
      process.env.NODE_ENV === "production"
    ) {
      this.sendToMonitoring();
    }
  }

  /**
   * Log successful login
   */
  logLoginSuccess(email: string): void {
    this.log(
      SecurityEventType.LOGIN_SUCCESS,
      SecurityLevel.INFO,
      "User logged in successfully",
      { email },
    );
  }

  /**
   * Log failed login attempt
   */
  logLoginFailure(email: string, reason: string): void {
    this.log(
      SecurityEventType.LOGIN_FAILURE,
      SecurityLevel.WARNING,
      "Login attempt failed",
      { email, reason },
    );
  }

  /**
   * Log logout
   */
  logLogout(email?: string): void {
    this.log(SecurityEventType.LOGOUT, SecurityLevel.INFO, "User logged out", {
      email,
    });
  }

  /**
   * Log token expiration
   */
  logTokenExpired(): void {
    this.log(
      SecurityEventType.TOKEN_EXPIRED,
      SecurityLevel.WARNING,
      "Authentication token expired",
    );
  }

  /**
   * Log invalid token
   */
  logTokenInvalid(reason: string): void {
    this.log(
      SecurityEventType.TOKEN_INVALID,
      SecurityLevel.ERROR,
      "Invalid authentication token detected",
      { reason },
    );
  }

  /**
   * Log unauthorized access attempt
   */
  logUnauthorizedAccess(path: string): void {
    this.log(
      SecurityEventType.UNAUTHORIZED_ACCESS,
      SecurityLevel.CRITICAL,
      "Unauthorized access attempt detected",
      { path, url: window.location.href },
    );
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(
    activity: string,
    details?: Record<string, unknown>,
  ): void {
    this.log(
      SecurityEventType.SUSPICIOUS_ACTIVITY,
      SecurityLevel.CRITICAL,
      `Suspicious activity detected: ${activity}`,
      details,
    );
  }

  /**
   * Log session timeout
   */
  logSessionTimeout(): void {
    this.log(
      SecurityEventType.SESSION_TIMEOUT,
      SecurityLevel.INFO,
      "Session timed out due to inactivity",
    );
  }

  /**
   * Log MFA events
   */
  logMFARequired(): void {
    this.log(
      SecurityEventType.MFA_REQUIRED,
      SecurityLevel.INFO,
      "Multi-factor authentication required",
    );
  }

  logMFASuccess(): void {
    this.log(
      SecurityEventType.MFA_SUCCESS,
      SecurityLevel.INFO,
      "Multi-factor authentication successful",
    );
  }

  logMFAFailure(reason: string): void {
    this.log(
      SecurityEventType.MFA_FAILURE,
      SecurityLevel.WARNING,
      "Multi-factor authentication failed",
      { reason },
    );
  }

  /**
   * Log DevTools detection
   */
  logDevToolsDetected(): void {
    this.log(
      SecurityEventType.DEVTOOLS_DETECTED,
      SecurityLevel.WARNING,
      "Browser DevTools detected - security monitoring active",
    );
  }

  /**
   * Log tab visibility changes
   */
  logTabHidden(duration?: number): void {
    this.log(
      SecurityEventType.TAB_HIDDEN,
      SecurityLevel.INFO,
      "Admin panel tab hidden",
      { duration },
    );
  }

  logTabVisible(): void {
    this.log(
      SecurityEventType.TAB_VISIBLE,
      SecurityLevel.INFO,
      "Admin panel tab visible",
    );
  }

  /**
   * Get all logged events
   */
  getEvents(): SecurityEvent[] {
    return [...this.events];
  }

  /**
   * Get events by type
   */
  getEventsByType(type: SecurityEventType): SecurityEvent[] {
    return this.events.filter((event) => event.type === type);
  }

  /**
   * Get events by level
   */
  getEventsByLevel(level: SecurityLevel): SecurityEvent[] {
    return this.events.filter((event) => event.level === level);
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Send critical events to monitoring service (placeholder)
   */
  private sendToMonitoring(): void {
    // TODO: Implement integration with monitoring service (e.g., Sentry, LogRocket)
    // This is a placeholder for future implementation
  }
}

// Singleton instance
export const securityLogger = new SecurityLogger();
