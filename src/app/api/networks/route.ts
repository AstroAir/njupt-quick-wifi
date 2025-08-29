import { type NextRequest, NextResponse } from "next/server";
import { SecurityType, NetworkType, type WiFiNetwork } from "@/types";
import { getNetworkManager } from "@/lib/network-manager";
import { authMiddleware } from "@/lib/auth-middleware";
import { validateSSID, validateWiFiPassword, sanitizeForSystemCommand } from "@/lib/input-validator";
import { logger } from "@/lib/logger";

/**
 * GET /api/networks
 * Returns all available networks from the last scan
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
    const networks = await networkManager.getAvailableNetworks();

    return NextResponse.json({ networks });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("Error fetching networks:", { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });

    // Provide more specific error messages based on error type
    let userMessage = "Failed to fetch networks";
    let statusCode = 500;

    if (errorMessage.includes("WiFi not available") || errorMessage.includes("No WiFi adapter")) {
      userMessage = "WiFi adapter not available. Please check your WiFi hardware.";
      statusCode = 503;
    } else if (errorMessage.includes("permission") || errorMessage.includes("access denied")) {
      userMessage = "Permission denied. Please run with appropriate privileges.";
      statusCode = 403;
    } else if (errorMessage.includes("timeout")) {
      userMessage = "Network scan timed out. Please try again.";
      statusCode = 408;
    }

    return NextResponse.json(
      {
        error: userMessage,
        code: "NETWORK_FETCH_ERROR",
        timestamp: Date.now()
      },
      { status: statusCode }
    );
  }
}

/**
 * POST /api/networks
 * Add a manual network (for hidden networks)
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
    const { ssid, security, password } = body;

    // Comprehensive input validation
    if (!ssid) {
      return NextResponse.json({ error: "SSID is required" }, { status: 400 });
    }

    // Validate SSID
    const ssidValidation = validateSSID(ssid);
    if (!ssidValidation.isValid) {
      return NextResponse.json(
        {
          error: "Invalid SSID",
          details: ssidValidation.errors
        },
        { status: 400 }
      );
    }

    // Validate security type
    if (security && !Object.values(SecurityType).includes(security)) {
      return NextResponse.json(
        { error: "Invalid security type" },
        { status: 400 }
      );
    }

    // Validate password if provided
    if (password) {
      const passwordValidation = validateWiFiPassword(password);
      if (!passwordValidation.isValid) {
        return NextResponse.json(
          {
            error: "Invalid password",
            details: passwordValidation.errors
          },
          { status: 400 }
        );
      }
    }

    // Sanitize inputs
    const sanitizedSSID = sanitizeForSystemCommand(ssid);

    // Use sanitized SSID for network operations
    logger.debug(`Processing network request for SSID: ${sanitizedSSID}`);

    // For secured networks, password is required
    if (security !== SecurityType.OPEN && !password) {
      return NextResponse.json(
        { error: "Password is required for secured networks" },
        { status: 400 }
      );
    }

    const networkManager = getNetworkManager();

    // Create a manual network entry
    const network: WiFiNetwork = {
      ssid,
      bssid: `manual_${Date.now()}`, // Generate a unique ID for manual networks
      security: security || SecurityType.WPA2,
      signalStrength: 0, // Unknown signal strength for manual networks
      type: NetworkType.WIFI,
      saved: true,
      settings: {
        autoConnect: true,
        redirectUrl: null,
        hidden: true,
        priority: 0,
        redirectTimeout: 3000,
      },
    };

    // Save the network with credentials
    const result = await networkManager.saveNetwork(network, password);

    return NextResponse.json({ success: true, network: result });
  } catch (error) {
    console.error("Error adding manual network:", error);
    return NextResponse.json(
      { error: "Failed to add network" },
      { status: 500 }
    );
  }
}
