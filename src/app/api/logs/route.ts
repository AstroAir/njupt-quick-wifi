import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { authMiddleware } from "@/lib/auth-middleware";

/**
 * GET /api/logs
 * Get system logs
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

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const level = searchParams.get("level") as
      | "debug"
      | "info"
      | "warn"
      | "error"
      | null;
    const limit = Number.parseInt(searchParams.get("limit") || "100", 10);

    // Get logs - convert null to undefined
    const logs = logger.getHistory(level || undefined, limit);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/logs
 * Clear system logs
 */
export async function DELETE(req: NextRequest) {
  try {
    // Check authentication
    const authResult = await authMiddleware(req);
    if (authResult.error) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Clear logs
    logger.clearHistory();

    return NextResponse.json({
      success: true,
      message: "Logs cleared successfully",
    });
  } catch (error) {
    console.error("Error clearing logs:", error);
    return NextResponse.json(
      { error: "Failed to clear logs" },
      { status: 500 }
    );
  }
}
