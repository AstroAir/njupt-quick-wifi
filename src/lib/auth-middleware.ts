import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { createHmac } from "crypto";

// Configuration for authentication behavior
interface AuthConfig {
  strictMode: boolean;
  jwtSecret: string;
  allowUnauthenticated: boolean;
  tokenExpiration: number; // in seconds
}

// Default configuration - can be overridden via environment variables
const authConfig: AuthConfig = {
  strictMode: process.env.AUTH_STRICT_MODE === "true",
  jwtSecret: process.env.JWT_SECRET || "default-dev-secret-change-in-production",
  allowUnauthenticated: process.env.ALLOW_UNAUTHENTICATED !== "false",
  tokenExpiration: parseInt(process.env.TOKEN_EXPIRATION || "3600"), // 1 hour default
};

interface JWTPayload {
  sub: string; // subject (user ID)
  iat: number; // issued at
  exp: number; // expiration
  scope?: string; // permissions scope
}

/**
 * Authentication middleware for API routes
 * Validates JWT tokens with configurable strict mode for backward compatibility
 */
export async function authMiddleware(
  req: NextRequest
): Promise<{ error?: string; status?: number; user?: unknown }> {
  logger.debug("Authenticating API request", {
    url: req.url,
    method: req.method,
    strictMode: authConfig.strictMode,
  });

  // Get the authorization header
  const authHeader = req.headers.get("authorization");

  // Handle authentication based on configuration
  if (!authHeader) {
    if (authConfig.strictMode && !authConfig.allowUnauthenticated) {
      logger.warn("No authorization header in strict mode");
      return { error: "Authorization header required", status: 401 };
    } else {
      logger.debug("No authorization header present, allowing for backward compatibility");
    }
  } else {
    // Validate the authorization header
    const validationResult = await validateAuthHeader(authHeader);
    if (validationResult.error) {
      if (authConfig.strictMode) {
        return validationResult;
      } else {
        logger.warn("Invalid auth header in non-strict mode, allowing request:", validationResult.error);
      }
    } else if (validationResult.user) {
      logger.debug("Authentication successful", { userId: validationResult.user.sub });
    }
  }

  // Check rate limiting
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const rateLimitResult = await checkRateLimit(clientIp);

  if (rateLimitResult.limited) {
    logger.warn("Rate limit exceeded", {
      ip: clientIp,
      limit: rateLimitResult.limit,
      remaining: rateLimitResult.remaining,
      reset: rateLimitResult.reset,
    });

    return {
      error: "Rate limit exceeded. Please try again later.",
      status: 429,
    };
  }

  // Authentication successful
  logger.debug("Authentication middleware completed successfully");
  return {};
}

/**
 * Validate authorization header and extract user information
 */
async function validateAuthHeader(authHeader: string): Promise<{ error?: string; status?: number; user?: JWTPayload }> {
  try {
    // Check if it's a Bearer token
    if (!authHeader.startsWith("Bearer ")) {
      return { error: "Invalid authorization header format. Expected 'Bearer <token>'", status: 401 };
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token || token.trim().length === 0) {
      return { error: "Empty token provided", status: 401 };
    }

    // Validate JWT token
    const payload = await validateJWT(token);

    if (!payload) {
      return { error: "Invalid or expired token", status: 401 };
    }

    // Check token expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { error: "Token has expired", status: 401 };
    }

    // Validate required claims
    if (!payload.sub) {
      return { error: "Token missing required subject claim", status: 401 };
    }

    return { user: payload };
  } catch (error) {
    logger.error("Error validating authorization header:", error);
    return { error: "Authentication validation failed", status: 500 };
  }
}

/**
 * Validate JWT token and extract payload
 * Simplified JWT validation - in production use a proper JWT library
 */
async function validateJWT(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      logger.warn("Invalid JWT format - expected 3 parts");
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header and payload
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

    // Validate header
    if (header.alg !== "HS256") {
      logger.warn("Unsupported JWT algorithm:", header.alg);
      return null;
    }

    // Verify signature
    const expectedSignature = createHmac("sha256", authConfig.jwtSecret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    if (signatureB64 !== expectedSignature) {
      logger.warn("JWT signature verification failed");
      return null;
    }

    // Validate payload structure
    if (typeof payload.sub !== "string" || typeof payload.iat !== "number") {
      logger.warn("Invalid JWT payload structure");
      return null;
    }

    return payload as JWTPayload;
  } catch (error) {
    logger.error("JWT validation error:", error);
    return null;
  }
}

/**
 * Generate a JWT token for testing purposes
 * In production, this would be handled by your authentication service
 */
export function generateTestToken(userId: string, scope?: string): string {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload: JWTPayload = {
    sub: userId,
    iat: now,
    exp: now + authConfig.tokenExpiration,
    ...(scope && { scope }),
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signature = createHmac("sha256", authConfig.jwtSecret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Simple in-memory rate limiting
 * In a real implementation, this would use Redis or similar
 */
interface RateLimitEntry {
  count: number;
  reset: number;
}

const rateLimits = new Map<string, RateLimitEntry>();
const RATE_LIMIT = 100; // requests per window
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in ms

async function checkRateLimit(clientIp: string): Promise<{
  limited: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const now = Date.now();

  // Get or create rate limit entry
  let entry = rateLimits.get(clientIp);

  if (!entry || entry.reset < now) {
    // Create new entry or reset expired entry
    entry = {
      count: 0,
      reset: now + RATE_LIMIT_WINDOW,
    };
  }

  // Increment count
  entry.count++;

  // Update entry
  rateLimits.set(clientIp, entry);

  // Check if rate limited
  const limited = entry.count > RATE_LIMIT;

  return {
    limited,
    limit: RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - entry.count),
    reset: entry.reset,
  };
}
