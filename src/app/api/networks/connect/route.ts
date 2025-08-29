import { type NextRequest, NextResponse } from "next/server";
import { getNetworkManager } from "@/lib/network-manager";
import { authMiddleware } from "@/lib/auth-middleware";
import { SecurityType } from "@/types";
import { validateConnectionRequest, sanitizeForSystemCommand } from "@/lib/input-validator";

/**
 * POST /api/networks/connect
 * Connect to a network
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

    const body = await req.json();

    // Comprehensive input validation
    const validationResult = validateConnectionRequest(body);
    if (!validationResult.isValid) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.errors
        },
        { status: 400 }
      );
    }

    const { bssid, ssid, password, saveNetwork = true } = body;

    // Sanitize inputs for safe system command usage
    const sanitizedSSID = ssid ? sanitizeForSystemCommand(ssid) : null;
    const sanitizedBSSID = bssid ? sanitizeForSystemCommand(bssid) : null;
    const sanitizedPassword = password ? password : null; // Don't sanitize passwords, just validate

    if (!sanitizedBSSID && !sanitizedSSID) {
      return NextResponse.json(
        { error: "Either BSSID or SSID is required" },
        { status: 400 }
      );
    }

    const networkManager = getNetworkManager();

    // Get the network details using sanitized inputs
    let network = null;
    if (sanitizedBSSID) {
      network = await networkManager.getNetworkByBssid(sanitizedBSSID);
    } else if (sanitizedSSID) {
      network = await networkManager.getNetworkBySsid(sanitizedSSID);
    }

    if (!network) {
      return NextResponse.json({ error: "Network not found" }, { status: 404 });
    }

    // Check if password is required but not provided
    if (network.security !== SecurityType.OPEN && !password) {
      // Check if we have saved credentials
      const hasSavedCredentials = await networkManager.hasSavedCredentials(
        network
      );

      if (!hasSavedCredentials) {
        return NextResponse.json(
          {
            error: "Password required for this network",
            requiresPassword: true,
          },
          { status: 400 }
        );
      }
    }

    // Start connection process with sanitized inputs
    const connectionId = await networkManager.connectToNetwork(
      network,
      sanitizedPassword,
      saveNetwork
    );

    return NextResponse.json({
      success: true,
      connectionId,
      message: "Connection process started",
    });
  } catch (error) {
    console.error("Error connecting to network:", error);
    return NextResponse.json(
      { error: "Failed to connect to network" },
      { status: 500 }
    );
  }
}
