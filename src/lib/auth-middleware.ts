import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Authentication middleware for API routes
 * In a real implementation, this would validate JWT tokens or session cookies
 */
export async function authMiddleware(
  req: NextRequest
): Promise<{ error?: string; status?: number }> {
  logger.debug("Authenticating API request", {
    url: req.url,
    method: req.method,
  });

  // Get the authorization header
  const authHeader = req.headers.get("authorization");

  // For demo purposes, we'll accept any authorization header
  // In a real implementation, you would validate JWT tokens or session cookies
  if (!authHeader) {
    // For this demo, we'll allow unauthenticated requests
    // In a real implementation, you would return an error
    logger.debug(
      "No authorization header present, allowing request for demo purposes"
    );
    // return { error: "Unauthorized", status: 401 }
  } else {
    logger.debug("Authorization header present", {
      headerType: authHeader.startsWith("Bearer ") ? "Bearer" : "Other",
    });
  }

  // Check rate limiting
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
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

  // If we get here, authentication is successful
  logger.debug("Authentication successful");
  return {};
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
