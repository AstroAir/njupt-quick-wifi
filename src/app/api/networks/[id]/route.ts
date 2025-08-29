import { type NextRequest, NextResponse } from "next/server";
import { getNetworkManager } from "@/lib/network-manager";
import { authMiddleware } from "@/lib/auth-middleware";

/**
 * GET /api/networks/:id
 * Get details for a specific network
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const authResult = await authMiddleware(req);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const resolvedParams = await params;
    const networkId = resolvedParams.id;
    if (!networkId) {
      return NextResponse.json(
        { error: "Network ID is required" },
        { status: 400 }
      );
    }

    const networkManager = getNetworkManager();
    const network = await networkManager.getNetworkByBssid(networkId);

    if (!network) {
      return NextResponse.json({ error: "Network not found" }, { status: 404 });
    }

    return NextResponse.json({ network });
  } catch (error) {
    console.error(`Error fetching network ${(await params).id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch network details" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/networks/:id
 * Update settings for a specific network
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const authResult = await authMiddleware(req);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const resolvedParams = await params;
    const networkId = resolvedParams.id;
    if (!networkId) {
      return NextResponse.json(
        { error: "Network ID is required" },
        { status: 400 }
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
    const network = await networkManager.getNetworkByBssid(networkId);

    if (!network) {
      return NextResponse.json({ error: "Network not found" }, { status: 404 });
    }

    // Update network settings
    const updatedNetwork = await networkManager.updateNetworkSettings(
      network,
      settings
    );

    return NextResponse.json({
      success: true,
      network: updatedNetwork,
    });
  } catch (error) {
    console.error(`Error updating network ${(await params).id}:`, error);
    return NextResponse.json(
      { error: "Failed to update network settings" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/networks/:id
 * Forget/remove a saved network
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const authResult = await authMiddleware(req);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const resolvedParams = await params;
    const networkId = resolvedParams.id;
    if (!networkId) {
      return NextResponse.json(
        { error: "Network ID is required" },
        { status: 400 }
      );
    }

    const networkManager = getNetworkManager();
    const network = await networkManager.getNetworkByBssid(networkId);

    if (!network) {
      return NextResponse.json({ error: "Network not found" }, { status: 404 });
    }

    // Forget the network
    await networkManager.forgetNetwork(network);

    return NextResponse.json({
      success: true,
      message: "Network forgotten",
    });
  } catch (error) {
    console.error(`Error forgetting network ${(await params).id}:`, error);
    return NextResponse.json(
      { error: "Failed to forget network" },
      { status: 500 }
    );
  }
}
