import { type NextRequest, NextResponse } from "next/server";
import { getNetworkManager } from "@/lib/network-manager";
import { authMiddleware } from "@/lib/auth-middleware";
import { SecurityType } from "@/types";

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
    const { bssid, ssid, password, saveNetwork = true } = body;

    if (!bssid && !ssid) {
      return NextResponse.json(
        { error: "Either BSSID or SSID is required" },
        { status: 400 }
      );
    }

    const networkManager = getNetworkManager();

    // Get the network details
    let network = null;
    if (bssid) {
      network = await networkManager.getNetworkByBssid(bssid);
    } else if (ssid) {
      network = await networkManager.getNetworkBySsid(ssid);
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

    // Start connection process
    const connectionId = await networkManager.connectToNetwork(
      network,
      password,
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
