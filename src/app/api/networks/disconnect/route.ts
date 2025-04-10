import { type NextRequest, NextResponse } from "next/server";
import { getNetworkManager } from "@/lib/network-manager";
import { authMiddleware } from "@/lib/auth-middleware";

/**
 * POST /api/networks/disconnect
 * Disconnect from the current network
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

    // Disconnect from current network
    await networkManager.disconnectFromNetwork();

    return NextResponse.json({
      success: true,
      message: "Disconnected from network",
    });
  } catch (error) {
    console.error("Error disconnecting from network:", error);
    return NextResponse.json(
      { error: "Failed to disconnect from network" },
      { status: 500 }
    );
  }
}
