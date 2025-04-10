import { type NextRequest, NextResponse } from "next/server";
import { getNetworkManager } from "@/lib/network-manager";
import { authMiddleware } from "@/lib/auth-middleware";

/**
 * GET /api/settings
 * Get global WiFi settings
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
    const settings = await networkManager.getSettings();

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * Update global WiFi settings
 */
export async function PUT(req: NextRequest) {
  try {
    // Check authentication
    const authResult = await authMiddleware(req);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await req.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json(
        { error: "Settings object is required" },
        { status: 400 }
      );
    }

    const networkManager = getNetworkManager();
    const updatedSettings = await networkManager.updateSettings(settings);

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
