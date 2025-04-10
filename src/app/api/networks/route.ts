import { type NextRequest, NextResponse } from "next/server";
import { SecurityType, NetworkType, type WiFiNetwork } from "@/types";
import { getNetworkManager } from "@/lib/network-manager";
import { authMiddleware } from "@/lib/auth-middleware";

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
    console.error("Error fetching networks:", error);
    return NextResponse.json(
      { error: "Failed to fetch networks" },
      { status: 500 }
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

    if (!ssid) {
      return NextResponse.json({ error: "SSID is required" }, { status: 400 });
    }

    // Validate security type
    if (security && !Object.values(SecurityType).includes(security)) {
      return NextResponse.json(
        { error: "Invalid security type" },
        { status: 400 }
      );
    }

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
