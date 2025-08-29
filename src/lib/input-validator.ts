import { logger } from "@/lib/logger";

/**
 * Comprehensive input validation and sanitization utilities
 * Prevents injection attacks and ensures data integrity
 */

// Regular expressions for validation
const SSID_REGEX = /^[a-zA-Z0-9\s\-_\.]{1,32}$/;
const BSSID_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const URL_REGEX = /^https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:\#(?:[\w.])*)?)?$/;
const PASSWORD_REGEX = /^.{8,63}$/; // WiFi passwords: 8-63 characters
const DEVICE_NAME_REGEX = /^[a-zA-Z0-9\-_]{1,50}$/;

// Dangerous characters that should be escaped in system commands
const DANGEROUS_CHARS = /[;&|`$(){}[\]<>'"\\]/g;

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  sanitized?: string;
  errors: string[];
}

/**
 * Validate and sanitize SSID
 */
export function validateSSID(ssid: string): ValidationResult {
  const errors: string[] = [];
  
  if (!ssid || typeof ssid !== 'string') {
    errors.push("SSID must be a non-empty string");
    return { isValid: false, errors };
  }

  if (ssid.length === 0 || ssid.length > 32) {
    errors.push("SSID must be between 1 and 32 characters");
  }

  if (!SSID_REGEX.test(ssid)) {
    errors.push("SSID contains invalid characters. Only alphanumeric, spaces, hyphens, underscores, and dots are allowed");
  }

  // Sanitize by removing dangerous characters
  const sanitized = ssid.replace(DANGEROUS_CHARS, '');
  
  if (sanitized !== ssid) {
    logger.warn(`SSID sanitized: "${ssid}" -> "${sanitized}"`);
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Validate and sanitize BSSID
 */
export function validateBSSID(bssid: string): ValidationResult {
  const errors: string[] = [];
  
  if (!bssid || typeof bssid !== 'string') {
    errors.push("BSSID must be a non-empty string");
    return { isValid: false, errors };
  }

  if (!BSSID_REGEX.test(bssid)) {
    errors.push("BSSID must be in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX");
  }

  // Normalize BSSID format (convert to colon-separated)
  const sanitized = bssid.replace(/-/g, ':').toLowerCase();

  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Validate WiFi password
 */
export function validateWiFiPassword(password: string): ValidationResult {
  const errors: string[] = [];
  
  if (!password || typeof password !== 'string') {
    errors.push("Password must be a string");
    return { isValid: false, errors };
  }

  if (!PASSWORD_REGEX.test(password)) {
    errors.push("WiFi password must be between 8 and 63 characters");
  }

  // Check for common weak passwords
  const weakPasswords = ['password', '12345678', 'qwerty123', 'admin123'];
  if (weakPasswords.includes(password.toLowerCase())) {
    errors.push("Password is too weak. Please use a stronger password");
  }

  return {
    isValid: errors.length === 0,
    sanitized: password, // Don't modify passwords
    errors
  };
}

/**
 * Validate URL
 */
export function validateURL(url: string): ValidationResult {
  const errors: string[] = [];
  
  if (!url || typeof url !== 'string') {
    errors.push("URL must be a non-empty string");
    return { isValid: false, errors };
  }

  if (!URL_REGEX.test(url)) {
    errors.push("URL must be a valid HTTP or HTTPS URL");
  }

  // Additional security checks
  if (url.includes('javascript:') || url.includes('data:')) {
    errors.push("JavaScript and data URLs are not allowed");
  }

  return {
    isValid: errors.length === 0,
    sanitized: url.trim(),
    errors
  };
}

/**
 * Validate IP address
 */
export function validateIPAddress(ip: string): ValidationResult {
  const errors: string[] = [];
  
  if (!ip || typeof ip !== 'string') {
    errors.push("IP address must be a non-empty string");
    return { isValid: false, errors };
  }

  if (!IP_REGEX.test(ip)) {
    errors.push("Invalid IP address format");
  }

  return {
    isValid: errors.length === 0,
    sanitized: ip.trim(),
    errors
  };
}

/**
 * Validate device name
 */
export function validateDeviceName(deviceName: string): ValidationResult {
  const errors: string[] = [];
  
  if (!deviceName || typeof deviceName !== 'string') {
    errors.push("Device name must be a non-empty string");
    return { isValid: false, errors };
  }

  if (!DEVICE_NAME_REGEX.test(deviceName)) {
    errors.push("Device name contains invalid characters");
  }

  const sanitized = deviceName.replace(DANGEROUS_CHARS, '');

  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * Sanitize string for safe use in system commands
 */
export function sanitizeForSystemCommand(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove dangerous characters
  let sanitized = input.replace(DANGEROUS_CHARS, '');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length to prevent buffer overflow
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
    logger.warn(`Input truncated to 255 characters: ${input.substring(0, 50)}...`);
  }

  return sanitized;
}

/**
 * Validate network connection request body
 */
export function validateConnectionRequest(body: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!body || typeof body !== 'object') {
    errors.push("Request body must be an object");
    return { isValid: false, errors };
  }

  const { ssid, bssid, password, saveNetwork } = body;

  // Validate SSID if provided
  if (ssid) {
    const ssidValidation = validateSSID(ssid);
    if (!ssidValidation.isValid) {
      errors.push(...ssidValidation.errors.map(e => `SSID: ${e}`));
    }
  }

  // Validate BSSID if provided
  if (bssid) {
    const bssidValidation = validateBSSID(bssid);
    if (!bssidValidation.isValid) {
      errors.push(...bssidValidation.errors.map(e => `BSSID: ${e}`));
    }
  }

  // Must have either SSID or BSSID
  if (!ssid && !bssid) {
    errors.push("Either SSID or BSSID must be provided");
  }

  // Validate password if provided
  if (password) {
    const passwordValidation = validateWiFiPassword(password);
    if (!passwordValidation.isValid) {
      errors.push(...passwordValidation.errors.map(e => `Password: ${e}`));
    }
  }

  // Validate saveNetwork flag
  if (saveNetwork !== undefined && typeof saveNetwork !== 'boolean') {
    errors.push("saveNetwork must be a boolean");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate settings update request
 */
export function validateSettingsRequest(settings: unknown): ValidationResult {
  const errors: string[] = [];
  
  if (!settings || typeof settings !== 'object') {
    errors.push("Settings must be an object");
    return { isValid: false, errors };
  }

  // Validate individual settings
  if (settings.defaultRedirectUrl && typeof settings.defaultRedirectUrl === 'string') {
    const urlValidation = validateURL(settings.defaultRedirectUrl);
    if (!urlValidation.isValid) {
      errors.push(...urlValidation.errors.map(e => `Redirect URL: ${e}`));
    }
  }

  if (settings.connectionTimeout !== undefined) {
    if (typeof settings.connectionTimeout !== 'number' || settings.connectionTimeout < 1000 || settings.connectionTimeout > 60000) {
      errors.push("Connection timeout must be a number between 1000 and 60000 milliseconds");
    }
  }

  if (settings.retryDelay !== undefined) {
    if (typeof settings.retryDelay !== 'number' || settings.retryDelay < 100 || settings.retryDelay > 30000) {
      errors.push("Retry delay must be a number between 100 and 30000 milliseconds");
    }
  }

  if (settings.maxRetryAttempts !== undefined) {
    if (typeof settings.maxRetryAttempts !== 'number' || settings.maxRetryAttempts < 0 || settings.maxRetryAttempts > 10) {
      errors.push("Max retry attempts must be a number between 0 and 10");
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Escape string for safe use in shell commands
 */
export function escapeShellArg(arg: string): string {
  if (!arg || typeof arg !== 'string') {
    return '""';
  }

  // For Windows, escape double quotes and wrap in quotes
  if (process.platform === 'win32') {
    return `"${arg.replace(/"/g, '""')}"`;
  }
  
  // For Unix-like systems, escape single quotes and wrap in single quotes
  return `'${arg.replace(/'/g, "'\"'\"'")}'`;
}
