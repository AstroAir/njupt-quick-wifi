import type { WiFiNetwork, ConnectionStatus, NetworkSettings } from "@/types";
import { logger } from "@/lib/logger";
import { EventEmitter } from "events";

// Define WebSocket callback types
interface WebSocketCallbacks {
  onScanUpdate?: (data: unknown) => void;
  onConnectionUpdate?: (data: unknown) => void;
  onNetworkUpdate?: (data: unknown) => void;
  onSettingsUpdate?: (data: unknown) => void;
  onError?: (error: unknown) => void;
}

// Define request queue item type
interface RequestQueueItem {
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

/**
 * API client for interacting with the WiFi backend
 */
class ApiClient extends EventEmitter {
  private baseUrl: string;
  private webSocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private requestQueue: RequestQueueItem[] = [];
  private isOffline = false;

  constructor() {
    super();
    this.baseUrl = "/api";

    // Set up offline/online event listeners
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
  }

  /**
   * Handle browser going online
   */
  private handleOnline = () => {
    logger.info(
      "Browser is online, reconnecting and processing queued requests"
    );
    this.isOffline = false;

    // Reconnect WebSocket with default callbacks
    this.setupWebSocket({
      onError: (error) => this.emit("error", error)
    });

    // Process queued requests
    this.processRequestQueue();
  };

  /**
   * Handle browser going offline
   */
  private handleOffline = () => {
    logger.warn("Browser is offline, requests will be queued");
    this.isOffline = true;

    // Close WebSocket
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }

    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  };

  /**
   * Process queued requests
   */
  private processRequestQueue() {
    if (this.isOffline || this.requestQueue.length === 0) return;

    logger.info(`Processing ${this.requestQueue.length} queued requests`);

    // Process all queued requests
    const requests = [...this.requestQueue];
    this.requestQueue = [];

    requests.forEach(async ({ endpoint, method, body, resolve, reject }) => {
      try {
        const result = await this.request(endpoint, method, body);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Helper method for making API requests
   */
  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown
  ): Promise<T> {
    // If offline, queue the request
    if (this.isOffline) {
      logger.debug(
        `Device is offline, queueing request: ${method} ${endpoint}`
      );
      return new Promise<T>((resolve, reject) => {
        this.requestQueue.push({
          endpoint,
          method,
          body,
          resolve: resolve as (value: unknown) => void,
          reject
        });
      });
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Add authorization header if we have a token
    const token = localStorage.getItem("wifi-auth-token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      logger.debug(`Making API request: ${method} ${endpoint}`);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        logger.error(`API error: ${response.status}`, error);
        throw new Error(error.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      logger.debug(`API response: ${method} ${endpoint}`, {
        status: response.status,
      });
      return data as T;
    } catch (error) {
      logger.error(`API request failed: ${method} ${endpoint}`, error);

      // Check if this is a network error (offline)
      if (error instanceof TypeError && error.message.includes("fetch")) {
        this.isOffline = true;
        logger.warn("Network error detected, device appears to be offline");

        // Queue the request for later
        return new Promise<T>((resolve, reject) => {
          this.requestQueue.push({
            endpoint,
            method,
            body,
            resolve: resolve as (value: unknown) => void,
            reject
          });
        });
      }

      throw error;
    }
  }

  /**
   * Get all available networks
   */
  async getNetworks(): Promise<WiFiNetwork[]> {
    const response = await this.request<{ networks: WiFiNetwork[] }>(
      "/networks"
    );
    return response.networks;
  }

  /**
   * Start a network scan
   */
  async startScan(): Promise<{ scanId: string }> {
    return this.request<{ scanId: string }>("/networks/scan", "POST");
  }

  /**
   * Get scan status
   */
  async getScanStatus(): Promise<{
    isScanning: boolean;
    scanProgress: number;
    lastScanTime: number | null;
    scanId: string | null;
    availableNetworkCount: number;
    scanDuration: number | null;
    error: string | null;
  }> {
    return this.request("/networks/scan");
  }

  /**
   * Connect to a network
   */
  async connectToNetwork(
    network: WiFiNetwork,
    password?: string,
    saveNetwork = true
  ): Promise<{ connectionId: string }> {
    return this.request("/networks/connect", "POST", {
      bssid: network.bssid,
      ssid: network.ssid,
      password,
      saveNetwork,
    });
  }

  /**
   * Disconnect from the current network
   */
  async disconnectFromNetwork(): Promise<{ success: boolean }> {
    return this.request("/networks/disconnect", "POST");
  }

  /**
   * Get network details
   */
  async getNetworkDetails(
    networkId: string
  ): Promise<{ network: WiFiNetwork }> {
    return this.request(`/networks/${networkId}`);
  }

  /**
   * Update network settings
   */
  async updateNetworkSettings(
    networkId: string,
    settings: Partial<NetworkSettings>
  ): Promise<{ network: WiFiNetwork }> {
    return this.request(`/networks/${networkId}`, "PUT", { settings });
  }

  /**
   * Forget a network
   */
  async forgetNetwork(networkId: string): Promise<{ success: boolean }> {
    return this.request(`/networks/${networkId}`, "DELETE");
  }

  /**
   * Add a manual network
   */
  async addManualNetwork(
    ssid: string,
    security: string,
    password?: string
  ): Promise<{ network: WiFiNetwork }> {
    return this.request("/networks", "POST", { ssid, security, password });
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(): Promise<{
    connectionStatus: ConnectionStatus;
    currentNetwork: WiFiNetwork | null;
    connectionError: string | null;
    lastConnectionTime: number | null;
    connectionId: string | null;
    signalStrength: number | null;
    ipAddress: string | null;
    connectionDuration: number | null;
    retryCount: number;
    retryAvailable: boolean;
  }> {
    return this.request("/status");
  }

  /**
   * Get global settings
   */
  async getSettings(): Promise<{
    defaultRedirectUrl: string | null;
    autoScanOnStartup: boolean;
    autoReconnect: boolean;
    secureStorage: boolean;
    defaultRedirectTimeout: number;
    scanInterval: number;
    animationsEnabled: boolean;
    darkMode: boolean | null;
    maxRetryAttempts: number;
    retryDelay: number;
    prioritizeKnownNetworks: boolean;
    connectionTimeout: number;
    enableLogging: boolean;
    logLevel: "debug" | "info" | "warn" | "error";
  }> {
    return this.request("/settings");
  }

  /**
   * Update global settings
   */
  async updateSettings(settings: {
    defaultRedirectUrl?: string | null;
    autoScanOnStartup?: boolean;
    autoReconnect?: boolean;
    secureStorage?: boolean;
    defaultRedirectTimeout?: number;
    scanInterval?: number;
    animationsEnabled?: boolean;
    darkMode?: boolean | null;
    maxRetryAttempts?: number;
    retryDelay?: number;
    prioritizeKnownNetworks?: boolean;
    connectionTimeout?: number;
    enableLogging?: boolean;
    logLevel?: "debug" | "info" | "warn" | "error";
  }): Promise<{ success: boolean }> {
    return this.request("/settings", "PUT", { settings });
  }

  /**
   * Get logs from the server
   */
  async getLogs(
    level?: "debug" | "info" | "warn" | "error",
    limit = 100
  ): Promise<{
    logs: Array<{
      timestamp: number;
      level: string;
      message: string;
      data?: unknown; // Changed from any to unknown
    }>;
  }> {
    const params = new URLSearchParams();
    if (level) params.append("level", level);
    if (limit) params.append("limit", limit.toString());

    return this.request(`/logs?${params.toString()}`);
  }

  /**
   * Set up WebSocket connection for real-time updates
   */
  setupWebSocket(callbacks: WebSocketCallbacks): () => void {
    // Close existing connection if any
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }

    // Clear existing timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Reset reconnect attempts
    this.reconnectAttempts = 0;

    // Don't attempt to connect if offline
    if (this.isOffline) {
      logger.warn("Device is offline, WebSocket connection deferred");
      return () => {};
    }

    logger.info("Setting up WebSocket connection for real-time updates");

    try {
      // Determine WebSocket URL from current location
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/websocket`;

      this.webSocket = new WebSocket(wsUrl);

      this.webSocket.onopen = () => {
        logger.info("WebSocket connection established");
        this.reconnectAttempts = 0;

        // Set up ping interval to keep connection alive
        this.pingInterval = setInterval(() => {
          if (this.webSocket?.readyState === WebSocket.OPEN) {
            this.webSocket.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000); // 30 seconds
      };

      this.webSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          logger.debug("WebSocket message received", data);

          // Handle different event types
          switch (data.type) {
            case "scanUpdate":
              if (callbacks.onScanUpdate) callbacks.onScanUpdate(data);
              this.emit("scanUpdate", data);
              break;

            case "connectionUpdate":
              if (callbacks.onConnectionUpdate)
                callbacks.onConnectionUpdate(data);
              this.emit("connectionUpdate", data);
              break;

            case "networkUpdate":
              if (callbacks.onNetworkUpdate) callbacks.onNetworkUpdate(data);
              this.emit("networkUpdate", data);
              break;

            case "settingsUpdate":
              if (callbacks.onSettingsUpdate) callbacks.onSettingsUpdate(data);
              this.emit("settingsUpdate", data);
              break;

            case "pong":
              logger.debug("WebSocket ping-pong successful");
              break;

            default:
              logger.warn("Unknown WebSocket message type", data);
          }
        } catch (error) {
          logger.error("Error parsing WebSocket message", error);
          if (callbacks.onError) callbacks.onError(error);
        }
      };

      this.webSocket.onerror = (error) => {
        logger.error("WebSocket error", error);
        if (callbacks.onError) callbacks.onError(error);
        this.emit("error", error);
      };

      this.webSocket.onclose = (event) => {
        logger.warn(
          `WebSocket connection closed: ${event.code} ${event.reason}`
        );

        // Clear ping interval
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && event.code !== 1001) {
          this.attemptReconnect();
        }

        this.emit("disconnected", { code: event.code, reason: event.reason });
      };
    } catch (error) {
      logger.error("Failed to set up WebSocket connection", error);
      if (callbacks.onError) callbacks.onError(error);
    }

    // Return a cleanup function
    return () => {
      logger.info("Cleaning up WebSocket connection");

      if (this.webSocket) {
        this.webSocket.close(1000, "Client disconnected");
        this.webSocket = null;
      }

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      if (typeof window !== "undefined") {
        window.removeEventListener("online", this.handleOnline);
        window.removeEventListener("offline", this.handleOffline);
      }
    };
  }

  /**
   * Attempt to reconnect WebSocket
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn(
        `Maximum reconnect attempts (${this.maxReconnectAttempts}) reached, giving up`
      );
      return;
    }

    this.reconnectAttempts++;
    const delay =
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);

    logger.info(
      `Attempting to reconnect WebSocket in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.setupWebSocket({
        onError: (error) => this.emit("error", error),
      });
    }, delay);
  }
}

// Singleton instance
export const apiClient = new ApiClient();
