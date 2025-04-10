import { type NextRequest, NextResponse } from "next/server";
import { getNetworkManager } from "@/lib/network-manager";
import { authMiddleware } from "@/lib/auth-middleware";

/**
 * GET /api/status
 * Get current connection status
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
    const status = await networkManager.getConnectionStatus();

    return NextResponse.json(status);
  } catch (error) {
    console.error("Error fetching connection status:", error);
    return NextResponse.json(
      { error: "Failed to fetch connection status" },
      { status: 500 }
    );
  }
}
