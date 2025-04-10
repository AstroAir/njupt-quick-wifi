import { type NextRequest, NextResponse } from "next/server";
import { getNetworkManager } from "@/lib/network-manager";
import { authMiddleware } from "@/lib/auth-middleware";

/**
 * GET /api/networks/current
 * 返回所有当前WiFi网络信息，包括：
 * - 当前连接的网络
 * - 连接状态
 * - 所有可用网络
 * - 所有保存的网络
 */
export async function GET(req: NextRequest) {
  try {
    // 验证用户身份
    const authResult = await authMiddleware(req);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const networkManager = getNetworkManager();
    
    // 并行获取所有需要的网络信息
    const [connectionStatus, availableNetworks, savedNetworks] = await Promise.all([
      networkManager.getConnectionStatus(),
      networkManager.getAvailableNetworks(),
      networkManager.getSavedNetworks()
    ]);

    return NextResponse.json({
      connectionStatus,
      availableNetworks,
      savedNetworks,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("获取当前网络状态出错:", error);
    return NextResponse.json(
      { error: "获取当前网络状态失败" },
      { status: 500 }
    );
  }
}