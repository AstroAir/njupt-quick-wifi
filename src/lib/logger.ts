/**
 * Logger utility for WiFi manager
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: unknown;
}

class Logger {
  private enabled = true;
  private level: LogLevel = "info";
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 1000;

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
    this.log("error", message, data);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.enabled) return;

    // Check if this log level should be shown
    if (!this.shouldLog(level)) return;

    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
    };

    // Add to history
    this.logHistory.push(logEntry);

    // Trim history if needed
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory = this.logHistory.slice(-this.maxHistorySize);
    }

    // Format the log message
    const formattedDate = new Date(logEntry.timestamp).toISOString();
    const logPrefix = `[${formattedDate}] [${level.toUpperCase()}]`;

    // Log to console with appropriate method
    switch (level) {
      case "debug":
        console.debug(`${logPrefix} ${message}`, data || "");
        break;
      case "info":
        console.info(`${logPrefix} ${message}`, data || "");
        break;
      case "warn":
        console.warn(`${logPrefix} ${message}`, data || "");
        break;
      case "error":
        console.error(`${logPrefix} ${message}`, data || "");
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
    return JSON.stringify(this.logHistory);
  }
}

// Singleton instance
export const logger = new Logger();
