import { logger } from "@/lib/logger";

// WebSocket connection management
const connections = new Set<WebSocket>();

/**
 * Add a WebSocket connection to the active connections set
 */
export function addConnection(socket: WebSocket): void {
  connections.add(socket);
  logger.info("New WebSocket connection added to manager");
}

/**
 * Remove a WebSocket connection from the active connections set
 */
export function removeConnection(socket: WebSocket): void {
  connections.delete(socket);
  logger.debug("WebSocket connection removed from manager");
}

/**
 * Get the current number of active connections
 */
export function getConnectionCount(): number {
  return connections.size;
}

/**
 * Send a message to a specific WebSocket client
 */
export function sendMessage(socket: WebSocket, message: unknown): void {
  try {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  } catch (error) {
    logger.error("Error sending WebSocket message:", error);
  }
}

/**
 * Broadcast a message to all connected clients
 */
export function broadcastMessage(message: unknown): void {
  const messageStr = JSON.stringify(message);

  for (const socket of connections) {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(messageStr);
      } else {
        // Remove closed connections
        connections.delete(socket);
      }
    } catch (error) {
      logger.error("Error broadcasting message:", error);
      connections.delete(socket);
    }
  }
}

/**
 * Close all active WebSocket connections
 */
export function closeAllConnections(): void {
  for (const socket of connections) {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    } catch (error) {
      logger.error("Error closing WebSocket connection:", error);
    }
  }
  connections.clear();
  logger.info("All WebSocket connections closed");
}

/**
 * Get all active connections (for debugging purposes)
 */
export function getActiveConnections(): Set<WebSocket> {
  return new Set(connections);
}
