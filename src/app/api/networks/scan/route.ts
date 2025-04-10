import { type NextRequest, NextResponse } from "next/server";
import { getNetworkManager } from "@/lib/network-manager";
import { authMiddleware } from "@/lib/auth-middleware";

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
    console.error("Error starting network scan:", error);
    return NextResponse.json(
      { error: "Failed to start network scan" },
      { status: 500 }
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
