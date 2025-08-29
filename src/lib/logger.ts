/**
 * Logger utility for WiFi manager
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: unknown;
  context?: string;
  correlationId?: string;
  stack?: string;
  performance?: {
    duration?: number;
    memory?: number;
    operation?: string;
  };
}

class Logger {
  private enabled = true;
  private level: LogLevel = "info";
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 1000;
  private context: string | null = null;
  private correlationId: string | null = null;
  private performanceTimers: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private debugMode = false;

  /**
   * Set whether logging is enabled
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Set debug mode for enhanced logging
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    if (enabled) {
      this.level = "debug";
    }
  }

  /**
   * Set logging context for grouping related logs
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Clear logging context
   */
  clearContext(): void {
    this.context = null;
  }

  /**
   * Set correlation ID for tracking related operations
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Clear correlation ID
   */
  clearCorrelationId(): void {
    this.correlationId = null;
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, data?: unknown): void {
    // Track error counts
    const errorKey = message.split(':')[0].trim();
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);

    // Include stack trace if data is an Error
    let stack: string | undefined;
    if (data instanceof Error) {
      stack = data.stack;
    }

    this.log("error", message, data, { stack });
  }

  /**
   * Start performance timing for an operation
   */
  startTimer(operation: string): void {
    this.performanceTimers.set(operation, performance.now());
    if (this.debugMode) {
      this.debug(`Started timer for operation: ${operation}`);
    }
  }

  /**
   * End performance timing and log the duration
   */
  endTimer(operation: string, message?: string): number | null {
    const startTime = this.performanceTimers.get(operation);
    if (!startTime) {
      this.warn(`No timer found for operation: ${operation}`);
      return null;
    }

    const duration = performance.now() - startTime;
    this.performanceTimers.delete(operation);

    const logMessage = message || `Operation completed: ${operation}`;
    const performanceData = {
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      memory: this.getMemoryUsage(),
      operation
    };

    this.log("info", logMessage, null, { performance: performanceData });

    if (this.debugMode) {
      this.debug(`Timer ended for operation: ${operation}, duration: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * Log with performance data
   */
  performance(operation: string, duration: number, message?: string): void {
    const logMessage = message || `Performance: ${operation}`;
    const performanceData = {
      duration: Math.round(duration * 100) / 100,
      memory: this.getMemoryUsage(),
      operation
    };

    this.log("info", logMessage, null, { performance: performanceData });
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: unknown, extra?: { stack?: string; performance?: Record<string, number> }): void {
    if (!this.enabled) return;

    // Check if this log level should be shown
    if (!this.shouldLog(level)) return;

    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
      context: this.context || undefined,
      correlationId: this.correlationId || undefined,
      stack: extra?.stack,
      performance: extra?.performance,
    };

    // Add to history
    this.logHistory.push(logEntry);

    // Trim history if needed
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory = this.logHistory.slice(-this.maxHistorySize);
    }

    // Format the log message
    const formattedDate = new Date(logEntry.timestamp).toISOString();
    let logPrefix = `[${formattedDate}] [${level.toUpperCase()}]`;

    // Add context and correlation ID if available
    if (this.context) {
      logPrefix += ` [${this.context}]`;
    }
    if (this.correlationId) {
      logPrefix += ` [${this.correlationId}]`;
    }

    // Prepare log data
    const logData: Record<string, unknown> = {};
    if (data) logData.data = data;
    if (extra?.performance) logData.performance = extra.performance;
    if (extra?.stack) logData.stack = extra.stack;

    // Log to console with appropriate method
    const hasData = Object.keys(logData).length > 0;
    switch (level) {
      case "debug":
        if (hasData) {
          console.debug(`${logPrefix} ${message}`, logData);
        } else {
          console.debug(`${logPrefix} ${message}`);
        }
        break;
      case "info":
        if (hasData) {
          console.info(`${logPrefix} ${message}`, logData);
        } else {
          console.info(`${logPrefix} ${message}`);
        }
        break;
      case "warn":
        if (hasData) {
          console.warn(`${logPrefix} ${message}`, logData);
        } else {
          console.warn(`${logPrefix} ${message}`);
        }
        break;
      case "error":
        if (hasData) {
          console.error(`${logPrefix} ${message}`, logData);
        } else {
          console.error(`${logPrefix} ${message}`);
        }
        break;
    }
  }

  /**
   * Check if a log level should be shown
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentLevelIndex = levels.indexOf(this.level);
    const logLevelIndex = levels.indexOf(level);

    return logLevelIndex >= currentLevelIndex;
  }

  /**
   * Get log history
   */
  getHistory(level?: LogLevel, limit = 100): LogEntry[] {
    let filteredLogs = this.logHistory;

    if (level) {
      filteredLogs = filteredLogs.filter((log) => log.level === level);
    }

    return filteredLogs.slice(-limit);
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }

  /**
   * Get memory usage information
   */
  private getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return Math.round((performance as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1024 / 1024 * 100) / 100; // MB
    }
    return 0;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): { [key: string]: number } {
    return Object.fromEntries(this.errorCounts);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): { activeTimers: string[]; completedOperations: LogEntry[] } {
    const activeTimers = Array.from(this.performanceTimers.keys());
    const completedOperations = this.logHistory.filter(entry => entry.performance);

    return {
      activeTimers,
      completedOperations
    };
  }

  /**
   * Create a scoped logger with context
   */
  createScope(context: string): ScopedLogger {
    return new ScopedLogger(this, context);
  }

  /**
   * Log with structured data for better debugging
   */
  structured(level: LogLevel, message: string, data: Record<string, unknown>): void {
    this.log(level, message, data);
  }

  /**
   * Log network operation with timing
   */
  networkOperation(operation: string, url: string, method: string, duration?: number, status?: number): void {
    const data = {
      operation,
      url,
      method,
      status,
      ...(duration && { duration: Math.round(duration * 100) / 100 })
    };

    this.structured("info", `Network: ${operation}`, data);
  }

  /**
   * Log WiFi operation with details
   */
  wifiOperation(operation: string, ssid?: string, bssid?: string, success?: boolean, error?: string): void {
    const data: Record<string, unknown> = { operation };
    if (ssid) data.ssid = ssid;
    if (bssid) data.bssid = bssid;
    if (success !== undefined) data.success = success;
    if (error) data.error = error;

    const level = success === false || error ? "error" : "info";
    this.structured(level, `WiFi: ${operation}`, data);
  }
}

/**
 * Scoped logger for context-specific logging
 */
class ScopedLogger {
  constructor(private parent: Logger, private scope: string) {}

  debug(message: string, data?: unknown): void {
    this.parent.setContext(this.scope);
    this.parent.debug(message, data);
    this.parent.clearContext();
  }

  info(message: string, data?: unknown): void {
    this.parent.setContext(this.scope);
    this.parent.info(message, data);
    this.parent.clearContext();
  }

  warn(message: string, data?: unknown): void {
    this.parent.setContext(this.scope);
    this.parent.warn(message, data);
    this.parent.clearContext();
  }

  error(message: string, data?: unknown): void {
    this.parent.setContext(this.scope);
    this.parent.error(message, data);
    this.parent.clearContext();
  }

  startTimer(operation: string): void {
    this.parent.startTimer(`${this.scope}:${operation}`);
  }

  endTimer(operation: string, message?: string): number | null {
    return this.parent.endTimer(`${this.scope}:${operation}`, message);
  }
}

// Singleton instance
export const logger = new Logger();
