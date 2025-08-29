import { type NextRequest, NextResponse } from "next/server";
import { getNetworkManager } from "@/lib/network-manager";
import { authMiddleware } from "@/lib/auth-middleware";
import { logger } from "@/lib/logger";

/**
 * POST /api/networks/scan
 * Trigger a network scan
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const authResult = await authMiddleware(req);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const networkManager = getNetworkManager();

    // Start the scan
    const scanId = await networkManager.startScan();

    return NextResponse.json({
      success: true,
      scanId,
      message: "Network scan started",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error starting network scan:", { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });

    // Provide more specific error messages based on error type
    let userMessage = "Failed to start network scan";
    let statusCode = 500;

    if (errorMessage.includes("WiFi not available") || errorMessage.includes("No WiFi adapter")) {
      userMessage = "WiFi adapter not available. Please check your WiFi hardware.";
      statusCode = 503;
    } else if (errorMessage.includes("permission") || errorMessage.includes("access denied")) {
      userMessage = "Permission denied. Please run with appropriate privileges to scan networks.";
      statusCode = 403;
    } else if (errorMessage.includes("busy") || errorMessage.includes("already scanning")) {
      userMessage = "WiFi adapter is busy. Please wait for current scan to complete.";
      statusCode = 409;
    }

    return NextResponse.json(
      {
        error: userMessage,
        code: "SCAN_START_ERROR",
        timestamp: Date.now()
      },
      { status: statusCode }
    );
  }
}

/**
 * GET /api/networks/scan
 * Get the status of the current or last scan
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const authResult = await authMiddleware(req);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const networkManager = getNetworkManager();
    const scanStatus = await networkManager.getScanStatus();

    return NextResponse.json(scanStatus);
  } catch (error) {
    console.error("Error getting scan status:", error);
    return NextResponse.json(
      { error: "Failed to get scan status" },
      { status: 500 }
    );
  }
}
