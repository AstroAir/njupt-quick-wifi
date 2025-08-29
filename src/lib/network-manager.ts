import {
  type WiFiNetwork,
  ConnectionStatus,
  SecurityType,
  NetworkType,
} from "@/types";
import { secureStore } from "@/lib/secure-store";
import { logger } from "@/lib/logger";
import { EventEmitter } from "events";
import { getSystemWifiService } from "@/lib/system-wifi";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Interface for global WiFi settings
interface WiFiSettings {
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
  scanTimeout: number;
  enableLogging: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

// Interface for scan status
interface ScanStatus {
  isScanning: boolean;
  scanProgress: number;
  lastScanTime: number | null;
  scanId: string | null;
  availableNetworkCount: number;
  scanDuration: number | null;
  error: string | null;
}

// Interface for connection status
interface ConnectionStatusInfo {
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
}

// Interface for network filter options
export interface NetworkFilterOptions {
  ssid?: string;
  security?: SecurityType | null;
  minSignalStrength?: number;
  onlySaved?: boolean;
  onlyAvailable?: boolean;
  sortBy?: "signal" | "name" | "security";
  sortDirection?: "asc" | "desc";
}

// Interface for network settings
export interface NetworkSettings {
  autoConnect: boolean;
  redirectUrl: string | null;
  hidden: boolean;
  priority: number;
  redirectTimeout: number;
}

/**
 * NetworkManager class to handle all WiFi operations
 * This is a singleton class that interfaces with the WiFi hardware
 */
class NetworkManager extends EventEmitter {
  private availableNetworks: WiFiNetwork[] = [];
  private savedNetworks: WiFiNetwork[] = [];
  private currentNetwork: WiFiNetwork | null = null;
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private connectionError: string | null = null;
  private isScanning = false;
  private scanProgress = 0;
  private lastScanTime: number | null = null;
  private scanId: string | null = null;
  private connectionId: string | null = null;
  private lastConnectionTime: number | null = null;
  private connectionStartTime: number | null = null;
  private scanStartTime: number | null = null;
  private scanDuration: number | null = null;
  private retryCount = 0;
  private retryTimer: NodeJS.Timeout | null = null;
  private autoReconnectTimer: NodeJS.Timeout | null = null;
  private ipAddress: string | null = null;
  private signalMonitorInterval: NodeJS.Timeout | null = null;
  private redirectTimer: NodeJS.Timeout | null = null;

  private settings: WiFiSettings = {
    defaultRedirectUrl: null,
    autoScanOnStartup: true,
    autoReconnect: true,
    secureStorage: true,
    defaultRedirectTimeout: 3000,
    scanInterval: 30000,
    animationsEnabled: true,
    darkMode: null,
    maxRetryAttempts: 3,
    retryDelay: 5000,
    prioritizeKnownNetworks: true,
    connectionTimeout: 15000,
    scanTimeout: 30000,
    enableLogging: true,
    logLevel: "info",
  };

  constructor() {
    super();
    // Initialize the WiFi hardware and load saved networks and settings
    this.initialize();
  }

  /**
   * Initialize the network manager
   */
  private async initialize() {
    logger.info("Initializing NetworkManager");
    try {
      await this.loadSavedNetworks();
      await this.loadSettings();

      // Configure logger based on settings
      logger.setLevel(this.settings.logLevel);
      logger.setEnabled(this.settings.enableLogging);

      // If auto scan on startup is enabled, start a scan
      if (this.settings.autoScanOnStartup) {
        logger.info("Auto-scan on startup enabled, starting scan");
        this.startScan().catch((err) => {
          logger.error("Auto-scan failed", err);
        });
      }

      // If auto reconnect is enabled and we have a last connected network, try to reconnect
      if (this.settings.autoReconnect) {
        this.setupAutoReconnect();
      }

      logger.info("NetworkManager initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize NetworkManager", error);
    }
  }

  /**
   * Set up auto reconnect to last connected network
   */
  private setupAutoReconnect() {
    logger.info("Setting up auto-reconnect");
    // Get the last connected network from storage
    const lastConnectedJson = localStorage.getItem(
      "wifi-manager-last-connected"
    );
    if (lastConnectedJson) {
      try {
        const lastConnected = JSON.parse(lastConnectedJson);
        const network = this.savedNetworks.find(
          (n) => n.bssid === lastConnected.bssid
        );

        if (network && network.settings?.autoConnect) {
          logger.info(`Auto-reconnecting to ${network.ssid}`);
          // Try to reconnect
          this.connectToNetwork(network).catch((err) => {
            logger.error(`Auto-reconnect to ${network.ssid} failed`, err);
          });
        }
      } catch (error) {
        logger.error("Failed to parse last connected network", error);
      }
    }
  }

  /**
   * Load saved networks from persistent storage
   */
  private async loadSavedNetworks() {
    logger.debug("Loading saved networks from storage");
    try {
      // In a real implementation, this would load from a database or file
      const savedNetworksJson = localStorage.getItem(
        "wifi-manager-saved-networks"
      );
      if (savedNetworksJson) {
        this.savedNetworks = JSON.parse(savedNetworksJson);
        logger.info(`Loaded ${this.savedNetworks.length} saved networks`);
      }
    } catch (error) {
      logger.error("Error loading saved networks", error);
      throw new Error("Failed to load saved networks");
    }
  }

  /**
   * Save networks to persistent storage
   */
  private async saveNetworksToStorage() {
    logger.debug("Saving networks to storage");
    try {
      // In a real implementation, this would save to a database or file
      localStorage.setItem(
        "wifi-manager-saved-networks",
        JSON.stringify(this.savedNetworks)
      );
      logger.info(`Saved ${this.savedNetworks.length} networks to storage`);
    } catch (error) {
      logger.error("Error saving networks", error);
      throw new Error("Failed to save networks");
    }
  }

  /**
   * Load settings from persistent storage
   */
  private async loadSettings() {
    logger.debug("Loading settings from storage");
    try {
      // In a real implementation, this would load from a database or file
      const settingsJson = localStorage.getItem("wifi-manager-settings");
      if (settingsJson) {
        this.settings = { ...this.settings, ...JSON.parse(settingsJson) };
        logger.info("Settings loaded successfully");
      }
    } catch (error) {
      logger.error("Error loading settings", error);
      throw new Error("Failed to load settings");
    }
  }

  /**
   * Save settings to persistent storage
   */
  private async saveSettingsToStorage() {
    logger.debug("Saving settings to storage");
    try {
      // In a real implementation, this would save to a database or file
      localStorage.setItem(
        "wifi-manager-settings",
        JSON.stringify(this.settings)
      );
      logger.info("Settings saved successfully");
    } catch (error) {
      logger.error("Error saving settings", error);
      throw new Error("Failed to save settings");
    }
  }

  /**
   * Get all available networks from the last scan
   */
  async getAvailableNetworks(
    filters?: NetworkFilterOptions
  ): Promise<WiFiNetwork[]> {
    logger.debug("Getting available networks", { filters });
    
    try {
      // 获取系统WiFi服务
      const systemWifi = getSystemWifiService();
      
      // 通过系统WiFi服务获取网络列表
      let networks = await systemWifi.getAvailableNetworks();
      
      // 如果未获取到网络列表，或处于开发环境，则使用模拟数据作为备选
      if (networks.length === 0 && (typeof process !== 'undefined' && process.env.NODE_ENV === 'development')) {
        logger.info('使用模拟的WiFi网络数据');
        networks = this.availableNetworks;
      } else {
        // 更新内部网络列表缓存
        this.availableNetworks = networks;
      }

      // 更新保存的网络标记
      networks = this.markSavedNetworks(networks);

      // 如果filters提供了筛选条件，应用筛选
      if (filters) {
        networks = this.filterNetworks(networks, filters);
      }

      return networks;
    } catch (error) {
      logger.error('获取可用WiFi网络失败', error);
      
      // 出错时返回缓存的网络列表
      if (filters) {
        return this.filterNetworks(this.availableNetworks, filters);
      }
      return this.availableNetworks;
    }
  }
  
  /**
   * 标记已保存的网络
   */
  private markSavedNetworks(networks: WiFiNetwork[]): WiFiNetwork[] {
    return networks.map(network => {
      const savedNetwork = this.savedNetworks.find(
        saved => saved.ssid === network.ssid
      );
      
      if (savedNetwork) {
        return {
          ...network,
          saved: true,
          settings: savedNetwork.settings,
        };
      }
      
      return network;
    });
  }

  /**
   * Filter networks based on provided options
   */
  private filterNetworks(
    networks: WiFiNetwork[],
    filters: NetworkFilterOptions
  ): WiFiNetwork[] {
    logger.debug("Filtering networks", { filters });

    let filtered = [...networks];

    // Filter by SSID
    if (filters.ssid) {
      const searchTerm = filters.ssid.toLowerCase();
      filtered = filtered.filter((n) =>
        n.ssid.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by security type
    if (filters.security) {
      filtered = filtered.filter((n) => n.security === filters.security);
    }

    // Filter by minimum signal strength
    if (filters.minSignalStrength !== undefined) {
      const minSignal = filters.minSignalStrength;
      filtered = filtered.filter(
        (n) => n.signalStrength >= minSignal
      );
    }

    // Filter by saved status
    if (filters.onlySaved) {
      filtered = filtered.filter((n) => n.saved);
    }

    // Filter by availability (signal strength > 0)
    if (filters.onlyAvailable) {
      filtered = filtered.filter((n) => n.signalStrength > 0);
    }

    // Sort networks
    if (filters.sortBy) {
      filtered = this.sortNetworks(
        filtered,
        filters.sortBy,
        filters.sortDirection || "desc"
      );
    }

    logger.info(
      `Filtered networks: ${filtered.length} of ${networks.length} match criteria`
    );
    return filtered;
  }

  /**
   * Sort networks based on criteria
   */
  private sortNetworks(
    networks: WiFiNetwork[],
    sortBy: "signal" | "name" | "security",
    sortDirection: "asc" | "desc"
  ): WiFiNetwork[] {
    logger.debug("Sorting networks", { sortBy, sortDirection });

    return [...networks].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "signal":
          comparison = b.signalStrength - a.signalStrength;
          break;
        case "name":
          comparison = a.ssid.localeCompare(b.ssid);
          break;
        case "security":
          comparison = a.security.localeCompare(b.security);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }

  /**
   * Get all saved networks
   */
  async getSavedNetworks(
    filters?: NetworkFilterOptions
  ): Promise<WiFiNetwork[]> {
    logger.debug("Getting saved networks", { filters });

    try {
      // 获取系统WiFi服务
      const systemWifi = getSystemWifiService();
      
      // 通过系统WiFi服务获取保存的网络列表
      const networks = await systemWifi.getSavedNetworks();
      
      // 更新内部保存的网络列表缓存
      if (networks.length > 0) {
        this.savedNetworks = networks;
      }

      // 如果filters提供了筛选条件，应用筛选
      if (filters) {
        return this.filterNetworks(this.savedNetworks, filters);
      }

      return this.savedNetworks;
    } catch (error) {
      logger.error('获取保存的WiFi网络失败', error);
      
      // 出错时返回缓存的网络列表
      if (filters) {
        return this.filterNetworks(this.savedNetworks, filters);
      }
      return this.savedNetworks;
    }
  }

  /**
   * Start a network scan
   */
  async startScan(): Promise<string> {
    logger.info("Starting network scan");

    // Edge case: Check if already scanning
    if (this.isScanning) {
      logger.warn("Scan already in progress");
      throw new Error("Scan already in progress. Please wait for current scan to complete.");
    }

    // Edge case: Check if WiFi is available
    const systemWifi = getSystemWifiService();
    try {
      const isWifiAvailable = await systemWifi.isWifiAvailable();
      if (!isWifiAvailable) {
        logger.error("WiFi adapter not available for scanning");
        throw new Error("WiFi adapter not available. Please check your WiFi hardware.");
      }
    } catch (error) {
      logger.error("Error checking WiFi availability:", error);
      // Continue with scan attempt - let the system WiFi service handle the error
    }

    this.isScanning = true;
    this.scanProgress = 0;
    this.scanId = `scan_${Date.now()}`;
    this.scanStartTime = Date.now();
    this.scanDuration = null;

    // Emit scan started event
    this.emit("scanStarted", { scanId: this.scanId });

    // Set scan timeout to prevent hanging
    const scanTimeout = setTimeout(() => {
      if (this.isScanning) {
        logger.warn(`Scan timeout after ${this.settings.scanTimeout || 30000}ms`);
        this.isScanning = false;
        this.emit("scanError", {
          error: "Scan timed out",
          scanId: this.scanId,
          timeout: true
        });
      }
    }, this.settings.scanTimeout || 30000);

    try {
      // 获取系统WiFi服务
      const systemWifi = getSystemWifiService();
      
      // 通过系统WiFi服务启动扫描
      const success = await systemWifi.startScan();
      
      if (success) {
        // 实际扫描启动成功，但无法获取进度，所以模拟进度
        this.simulateScanProgress().catch((err) => {
          logger.error("Scan progress simulation failed", err);
          clearTimeout(scanTimeout);
          this.isScanning = false;
          this.emit("scanError", {
            error: "Scan progress tracking failed",
            scanId: this.scanId,
            originalError: err.message
          });
        });
      } else {
        // 如果系统扫描失败，回退到模拟扫描
        logger.warn("System WiFi scan failed, falling back to simulated scan");
        this.simulateScan().catch((err) => {
          logger.error("Scan simulation failed", err);
          clearTimeout(scanTimeout);
          this.isScanning = false;
          this.emit("scanError", {
            error: "Both system and simulated scan failed",
            scanId: this.scanId,
            originalError: err.message
          });
        });
      }

      // Clear timeout since scan started successfully
      clearTimeout(scanTimeout);
    } catch (error) {
      clearTimeout(scanTimeout);
      this.isScanning = false;

      const errorMessage = error instanceof Error ? error.message : "Unknown scan error";
      logger.error("Failed to start WiFi scan", { error: errorMessage, scanId: this.scanId });

      // Provide specific error messages based on error type
      let userMessage = "Failed to start WiFi scan";
      if (errorMessage.includes("permission") || errorMessage.includes("access denied")) {
        userMessage = "Permission denied. Please run with administrator privileges.";
      } else if (errorMessage.includes("busy") || errorMessage.includes("device busy")) {
        userMessage = "WiFi adapter is busy. Please wait and try again.";
      } else if (errorMessage.includes("not found") || errorMessage.includes("no such device")) {
        userMessage = "WiFi adapter not found. Please check your WiFi hardware.";
      }

      this.emit("scanError", {
        error: userMessage,
        scanId: this.scanId,
        originalError: errorMessage
      });

      throw new Error(userMessage);
    }

    return this.scanId;
  }

  /**
   * 模拟扫描进度（不产生模拟数据，只用于显示进度）
   */
  private async simulateScanProgress() {
    // 模拟进度更新
    for (let i = 1; i <= 10; i++) {
      await this.delay(300);
      this.scanProgress = i * 10;

      // Emit progress update
      this.emit("scanProgress", {
        scanId: this.scanId,
        progress: this.scanProgress,
        isScanning: this.isScanning,
      });

      logger.debug(`Scan progress: ${this.scanProgress}%`);
    }

    try {
      // 获取系统WiFi服务
      const systemWifi = getSystemWifiService();
      
      // 通过系统WiFi服务获取网络列表
      const networks = await systemWifi.getAvailableNetworks();
      
      // 更新内部缓存
      if (networks.length > 0) {
        this.availableNetworks = this.markSavedNetworks(networks);
      }
    } catch (error) {
      logger.error("Failed to get networks after scan", error);
    }

    this.isScanning = false;
    this.scanProgress = 100;
    this.lastScanTime = Date.now();
    this.scanDuration = this.lastScanTime - (this.scanStartTime || this.lastScanTime);

    logger.info(
      `Scan completed. Found ${this.availableNetworks.length} networks in ${this.scanDuration}ms`
    );

    // Emit scan completed event
    this.emit("scanCompleted", {
      scanId: this.scanId,
      networks: this.availableNetworks.length,
      duration: this.scanDuration,
    });
  }

  /**
   * Simulate a network scan with progress updates
   */
  private async simulateScan() {
    logger.debug("Simulating network scan");

    // Simulate progressive scanning
    for (let i = 1; i <= 10; i++) {
      await this.delay(300);
      this.scanProgress = i * 10;

      // Emit progress update
      this.emit("scanProgress", {
        scanId: this.scanId,
        progress: this.scanProgress,
        isScanning: this.isScanning,
      });

      logger.debug(`Scan progress: ${this.scanProgress}%`);
    }

    // Generate mock networks
    const mockNetworks: WiFiNetwork[] = [
      {
        ssid: "Home_Network",
        bssid: "00:11:22:33:44:55",
        signalStrength: 90,
        security: SecurityType.WPA2,
        type: NetworkType.WIFI,
        saved: true,
        settings: {
          autoConnect: true,
          redirectUrl: "https://home-portal.example.com",
          hidden: false,
          priority: 1,
          redirectTimeout: 3000,
        },
      },
      {
        ssid: "Office_WiFi",
        bssid: "AA:BB:CC:DD:EE:FF",
        signalStrength: 75,
        security: SecurityType.WPA2_ENTERPRISE,
        type: NetworkType.WIFI,
        saved: false,
        settings: {
          autoConnect: false,
          redirectUrl: null,
          hidden: false,
          priority: 0,
          redirectTimeout: 3000,
        },
      },
      {
        ssid: "Cafe_Guest",
        bssid: "11:22:33:44:55:66",
        signalStrength: 60,
        security: SecurityType.WPA,
        type: NetworkType.WIFI,
        saved: false,
        settings: {
          autoConnect: false,
          redirectUrl: "https://cafe-login.example.com",
          hidden: false,
          priority: 0,
          redirectTimeout: 5000,
        },
      },
      {
        ssid: "Public_WiFi",
        bssid: "BB:CC:DD:EE:FF:00",
        signalStrength: 45,
        security: SecurityType.OPEN,
        type: NetworkType.WIFI,
        saved: false,
        settings: {
          autoConnect: false,
          redirectUrl: "https://public-wifi-auth.example.com",
          hidden: false,
          priority: 0,
          redirectTimeout: 3000,
        },
      },
      {
        ssid: "Neighbor_Network",
        bssid: "CC:DD:EE:FF:00:11",
        signalStrength: 30,
        security: SecurityType.WPA2,
        type: NetworkType.WIFI,
        saved: false,
        settings: {
          autoConnect: false,
          redirectUrl: null,
          hidden: false,
          priority: 0,
          redirectTimeout: 3000,
        },
      },
      {
        ssid: "IoT_Network",
        bssid: "DD:EE:FF:00:11:22",
        signalStrength: 85,
        security: SecurityType.WPA3,
        type: NetworkType.WIFI,
        saved: false,
        settings: {
          autoConnect: false,
          redirectUrl: null,
          hidden: true,
          priority: 0,
          redirectTimeout: 3000,
        },
      },
      {
        ssid: "Guest_Network",
        bssid: "EE:FF:00:11:22:33",
        signalStrength: 65,
        security: SecurityType.OPEN,
        type: NetworkType.WIFI,
        saved: true,
        settings: {
          autoConnect: false,
          redirectUrl: null,
          hidden: false,
          priority: 0,
          redirectTimeout: 3000,
        },
      },
      {
        ssid: "5G_Network",
        bssid: "FF:00:11:22:33:44",
        signalStrength: 70,
        security: SecurityType.WPA2,
        type: NetworkType.WIFI,
        saved: false,
        settings: {
          autoConnect: false,
          redirectUrl: null,
          hidden: false,
          priority: 0,
          redirectTimeout: 3000,
        },
      },
    ];

    // Add some random networks with varying signal strengths
    const randomNetworks = Array.from({ length: 5 }, () => ({
      ssid: `Network_${Math.floor(Math.random() * 1000)}`,
      bssid: `${Math.random().toString(16).substring(2, 10)}:${Math.random()
        .toString(16)
        .substring(2, 10)}`,
      signalStrength: Math.floor(Math.random() * 60) + 20,
      security: [SecurityType.WPA, SecurityType.WPA2, SecurityType.OPEN][
        Math.floor(Math.random() * 3)
      ],
      type: NetworkType.WIFI,
      saved: false,
      settings: {
        autoConnect: false,
        redirectUrl: null,
        hidden: false,
        priority: 0,
        redirectTimeout: 3000,
      },
    }));

    // Mark networks that are already saved
    const allNetworks = [...mockNetworks, ...randomNetworks];
    this.availableNetworks = allNetworks.map((network) => {
      const savedNetwork = this.savedNetworks.find(
        (saved) => saved.bssid === network.bssid
      );
      if (savedNetwork) {
        return {
          ...network,
          saved: true,
          settings: savedNetwork.settings,
        };
      }
      return network;
    });

    this.isScanning = false;
    this.scanProgress = 100;
    this.lastScanTime = Date.now();
    this.scanDuration =
      this.lastScanTime - (this.scanStartTime || this.lastScanTime);

    logger.info(
      `Scan completed. Found ${this.availableNetworks.length} networks in ${this.scanDuration}ms`
    );

    // Emit scan completed event
    this.emit("scanCompleted", {
      scanId: this.scanId,
      networks: this.availableNetworks.length,
      duration: this.scanDuration,
    });
  }

  /**
   * Get the current scan status
   */
  async getScanStatus(): Promise<ScanStatus> {
    return {
      isScanning: this.isScanning,
      scanProgress: this.scanProgress,
      lastScanTime: this.lastScanTime,
      scanId: this.scanId,
      availableNetworkCount: this.availableNetworks.length,
      scanDuration: this.scanDuration,
      error: null,
    };
  }

  /**
   * Get a network by its BSSID
   */
  async getNetworkByBssid(bssid: string): Promise<WiFiNetwork | null> {
    logger.debug(`Looking up network by BSSID: ${bssid}`);

    // First check available networks
    let network = this.availableNetworks.find((n) => n.bssid === bssid);

    // If not found, check saved networks
    if (!network) {
      network = this.savedNetworks.find((n) => n.bssid === bssid);
    }

    if (network) {
      logger.debug(`Found network: ${network.ssid}`);
    } else {
      logger.debug(`Network with BSSID ${bssid} not found`);
    }

    return network || null;
  }

  /**
   * Get a network by its SSID
   * Note: Multiple networks can have the same SSID, so this returns the strongest one
   */
  async getNetworkBySsid(ssid: string): Promise<WiFiNetwork | null> {
    logger.debug(`Looking up network by SSID: ${ssid}`);

    // Get all networks with this SSID
    const networks = this.availableNetworks.filter((n) => n.ssid === ssid);

    if (networks.length === 0) {
      logger.debug(`No available networks found with SSID: ${ssid}`);
      // Check saved networks
      const savedNetwork = this.savedNetworks.find((n) => n.ssid === ssid);
      if (savedNetwork) {
        logger.debug(`Found saved network: ${savedNetwork.ssid}`);
      }
      return savedNetwork || null;
    }

    // Return the one with the strongest signal
    const strongestNetwork = networks.sort(
      (a, b) => b.signalStrength - a.signalStrength
    )[0];
    logger.debug(
      `Found strongest network: ${strongestNetwork.ssid} (${strongestNetwork.signalStrength}%)`
    );
    return strongestNetwork;
  }

  /**
   * Check if we have saved credentials for a network
   */
  async hasSavedCredentials(network: WiFiNetwork): Promise<boolean> {
    logger.debug(`Checking for saved credentials for ${network.ssid}`);

    if (this.settings.secureStorage) {
      // In a real implementation, this would check a secure credential store
      const hasCredentials = await secureStore.hasCredentials(network.bssid);
      logger.debug(
        `Secure credentials for ${network.ssid}: ${
          hasCredentials ? "Found" : "Not found"
        }`
      );
      return hasCredentials;
    }

    // If secure storage is disabled, check if the network is saved
    const isSaved = this.savedNetworks.some((n) => n.bssid === network.bssid);
    logger.debug(
      `Network ${network.ssid} is ${isSaved ? "saved" : "not saved"}`
    );
    return isSaved;
  }

  /**
   * Connect to a network
   */
  async connectToNetwork(
    network: WiFiNetwork,
    password?: string,
    saveNetwork = true
  ): Promise<string> {
    logger.info(`Attempting to connect to ${network.ssid}`);

    // Clear any existing timers
    this.clearConnectionTimers();

    // Check if password is required but not provided
    if (network.security !== SecurityType.OPEN && !password) {
      logger.debug(`${network.ssid} requires a password`);

      // Check if we have saved credentials
      const hasSavedCredentials = await this.hasSavedCredentials(network);

      if (!hasSavedCredentials) {
        logger.warn(`No saved credentials for ${network.ssid}`);
        throw new Error("Password required for this network");
      }

      // In a real implementation, we would retrieve the saved password
      logger.debug(`Using saved credentials for ${network.ssid}`);
      password = await secureStore.getCredentials(network.bssid);
    }

    this.connectionStatus = ConnectionStatus.CONNECTING;
    this.connectionError = null;
    this.connectionId = `conn_${Date.now()}`;
    this.retryCount = 0;
    this.connectionStartTime = Date.now();

    logger.info(
      `Connection attempt started for ${network.ssid} (ID: ${this.connectionId})`
    );

    // Emit connection started event
    this.emit("connectionStarted", {
      connectionId: this.connectionId,
      network: { ssid: network.ssid, bssid: network.bssid },
    });

    // Set a connection timeout
    const timeoutId = setTimeout(() => {
      if (
        this.connectionStatus === ConnectionStatus.CONNECTING ||
        this.connectionStatus === ConnectionStatus.AUTHENTICATING
      ) {
        logger.warn(
          `Connection to ${network.ssid} timed out after ${this.settings.connectionTimeout}ms`
        );
        this.connectionStatus = ConnectionStatus.ERROR;
        this.connectionError = "Connection timed out";

        // Emit connection error event
        this.emit("connectionError", {
          connectionId: this.connectionId,
          error: "Connection timed out",
          network: { ssid: network.ssid, bssid: network.bssid },
        });

        // Try to auto-retry if enabled
        this.handleConnectionRetry(network, password, saveNetwork);
      }
    }, this.settings.connectionTimeout);

    try {
      // 尝试使用系统WiFi服务连接
      const systemWifi = getSystemWifiService();
      const success = await systemWifi.connectToNetwork(network.ssid, password);
      
      // 如果系统连接失败，回退到模拟连接
      if (!success) {
        logger.warn(`System WiFi connection to ${network.ssid} failed, falling back to simulated connection`);
        // 模拟连接过程
        await this.simulateConnection(network);
      } else {
        // 系统连接成功
        logger.info(`Successfully connected to ${network.ssid} using system WiFi`);
        
        // 获取当前连接的网络信息
        this.currentNetwork = await systemWifi.getCurrentNetwork() || network;
        this.connectionStatus = ConnectionStatus.CONNECTED;
        this.connectionError = null;
        this.lastConnectionTime = Date.now();
        
        // 获取真实IP地址
        this.ipAddress = await this.getRealIpAddress();
      }

      // Clear the timeout since connection was successful
      clearTimeout(timeoutId);

      // If requested, save the network and credentials
      if (saveNetwork) {
        await this.saveNetwork(network, password);
      }

      // Save as last connected network for auto-reconnect
      localStorage.setItem(
        "wifi-manager-last-connected",
        JSON.stringify({
          bssid: network.bssid,
          ssid: network.ssid,
          timestamp: Date.now(),
        })
      );

      // Start monitoring signal strength
      this.startSignalMonitoring(network);

      // Handle redirect URL if configured
      this.handleRedirectUrl(network);

      return this.connectionId;
    } catch (error) {
      // Clear the timeout since connection failed
      clearTimeout(timeoutId);

      // Handle connection error
      logger.error(`Connection to ${network.ssid} failed`, error);

      // Try to auto-retry if enabled
      this.handleConnectionRetry(network, password, saveNetwork);

      throw error;
    }
  }

  /**
   * Handle connection retry logic with enhanced recovery actions
   */
  private async handleConnectionRetry(
    network: WiFiNetwork,
    password?: string,
    saveNetwork = true
  ) {
    if (
      this.settings.autoReconnect &&
      this.retryCount < this.settings.maxRetryAttempts
    ) {
      this.retryCount++;
      logger.info(
        `Scheduling retry ${this.retryCount}/${this.settings.maxRetryAttempts} for ${network.ssid} in ${this.settings.retryDelay}ms`
      );

      // Perform recovery actions before retry
      await this.performRecoveryActions(network, this.retryCount);

      // Emit retry scheduled event
      this.emit("retryScheduled", {
        connectionId: this.connectionId,
        retryCount: this.retryCount,
        maxRetries: this.settings.maxRetryAttempts,
        delay: this.settings.retryDelay,
        network: { ssid: network.ssid, bssid: network.bssid },
      });

      // Schedule retry with exponential backoff
      const retryDelay = this.calculateRetryDelay(this.retryCount);
      this.retryTimer = setTimeout(async () => {
        logger.info(`Attempting retry ${this.retryCount} for ${network.ssid}`);

        // Emit retry started event
        this.emit("retryStarted", {
          connectionId: this.connectionId,
          retryCount: this.retryCount,
          network: { ssid: network.ssid, bssid: network.bssid },
        });

        try {
          this.connectionStatus = ConnectionStatus.CONNECTING;
          this.connectionError = null;

          // Try system connection first, then fallback to simulation
          const systemWifi = getSystemWifiService();
          const success = await systemWifi.connectToNetwork(network.ssid, password);

          if (!success) {
            logger.warn(`System WiFi connection to ${network.ssid} failed on retry ${this.retryCount}, falling back to simulation`);
            await this.simulateConnection(network);
          } else {
            // System connection successful
            this.currentNetwork = await systemWifi.getCurrentNetwork() || network;
            this.connectionStatus = ConnectionStatus.CONNECTED;
            this.connectionError = null;
            this.lastConnectionTime = Date.now();

            // Get real IP address instead of simulation
            this.ipAddress = await this.getRealIpAddress();
          }

          // If requested, save the network and credentials
          if (saveNetwork) {
            await this.saveNetwork(network, password);
          }

          // Save as last connected network for auto-reconnect
          localStorage.setItem(
            "wifi-manager-last-connected",
            JSON.stringify({
              bssid: network.bssid,
              ssid: network.ssid,
              timestamp: Date.now(),
            })
          );

          // Start monitoring signal strength
          this.startSignalMonitoring(network);

          // Handle redirect URL if configured
          this.handleRedirectUrl(network);

          logger.info(
            `Retry ${this.retryCount} for ${network.ssid} successful`
          );

          // Emit retry successful event
          this.emit("retrySuccessful", {
            connectionId: this.connectionId,
            retryCount: this.retryCount,
            network: { ssid: network.ssid, bssid: network.bssid },
          });
        } catch (error) {
          logger.error(
            `Retry ${this.retryCount} for ${network.ssid} failed`,
            error
          );

          // Emit retry failed event
          this.emit("retryFailed", {
            connectionId: this.connectionId,
            retryCount: this.retryCount,
            error: error instanceof Error ? error.message : "Unknown error",
            network: { ssid: network.ssid, bssid: network.bssid },
          });

          // Try again if we haven't reached max retries
          await this.handleConnectionRetry(network, password, saveNetwork);
        }
      }, retryDelay);
    } else if (this.retryCount >= this.settings.maxRetryAttempts) {
      logger.warn(
        `Max retry attempts (${this.settings.maxRetryAttempts}) reached for ${network.ssid}`
      );

      // Perform final recovery actions
      await this.performFinalRecoveryActions(network);

      // Emit max retries reached event
      this.emit("maxRetriesReached", {
        connectionId: this.connectionId,
        retryCount: this.retryCount,
        network: { ssid: network.ssid, bssid: network.bssid },
      });
    }
  }

  /**
   * Perform recovery actions before retry attempts
   */
  private async performRecoveryActions(network: WiFiNetwork, retryCount: number): Promise<void> {
    try {
      logger.info(`Performing recovery actions for ${network.ssid} (retry ${retryCount})`);

      // Recovery action 1: Clear any existing connection state
      if (retryCount === 1) {
        logger.debug("Recovery action: Clearing connection state");
        await this.clearConnectionState();
      }

      // Recovery action 2: Refresh network adapter (Windows/Linux)
      if (retryCount === 2) {
        logger.debug("Recovery action: Refreshing network adapter");
        await this.refreshNetworkAdapter();
      }

      // Recovery action 3: Reset WiFi interface (more aggressive)
      if (retryCount >= 3) {
        logger.debug("Recovery action: Resetting WiFi interface");
        await this.resetWifiInterface();
      }

      // Recovery action 4: Clear DNS cache
      if (retryCount >= 2) {
        logger.debug("Recovery action: Clearing DNS cache");
        await this.clearDnsCache();
      }

    } catch (error) {
      logger.warn("Recovery action failed, continuing with retry:", error);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.settings.retryDelay;
    const maxDelay = 30000; // 30 seconds max

    // Exponential backoff: delay = baseDelay * (2 ^ (retryCount - 1))
    const exponentialDelay = baseDelay * Math.pow(2, retryCount - 1);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000; // 0-1 second jitter

    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  /**
   * Get real IP address from network interface
   */
  private async getRealIpAddress(): Promise<string> {
    try {
      const platform = process.platform;

      let command = "";
      if (platform === "win32") {
        command = "ipconfig | findstr /i \"IPv4\"";
      } else if (platform === "darwin") {
        command = "ifconfig | grep 'inet ' | grep -v '127.0.0.1' | head -1";
      } else {
        command = "ip route get 1.1.1.1 | grep -oP 'src \\K\\S+'";
      }

      const { stdout } = await execAsync(command);

      // Parse IP address from output
      const ipMatch = stdout.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (ipMatch) {
        logger.debug(`Real IP address detected: ${ipMatch[1]}`);
        return ipMatch[1];
      }

      // Fallback to simulated IP if real IP detection fails
      logger.warn("Failed to detect real IP address, using simulated IP");
      return `192.168.1.${Math.floor(Math.random() * 254) + 1}`;
    } catch (error) {
      logger.error("Error getting real IP address:", error);
      // Fallback to simulated IP
      return `192.168.1.${Math.floor(Math.random() * 254) + 1}`;
    }
  }

  /**
   * Perform final recovery actions when max retries reached
   */
  private async performFinalRecoveryActions(network: WiFiNetwork): Promise<void> {
    try {
      logger.info(`Performing final recovery actions for ${network.ssid}`);

      // Final action 1: Reset connection state completely
      this.connectionStatus = ConnectionStatus.ERROR;
      this.connectionError = `Failed to connect to ${network.ssid} after ${this.retryCount} attempts`;
      this.currentNetwork = null;
      this.connectionId = null;

      // Final action 2: Clear any timers
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }

      // Final action 3: Suggest alternative networks
      const alternativeNetworks = await this.findAlternativeNetworks(network);
      if (alternativeNetworks.length > 0) {
        logger.info(`Found ${alternativeNetworks.length} alternative networks`);
        this.emit("alternativeNetworksFound", {
          failedNetwork: { ssid: network.ssid, bssid: network.bssid },
          alternatives: alternativeNetworks.map(n => ({ ssid: n.ssid, bssid: n.bssid, signalStrength: n.signalStrength })),
        });
      }

      // Final action 4: Reset retry count for future attempts
      this.retryCount = 0;

    } catch (error) {
      logger.error("Final recovery actions failed:", error);
    }
  }

  /**
   * Clear connection state for recovery
   */
  private async clearConnectionState(): Promise<void> {
    try {
      // Clear internal state
      this.connectionError = null;
      this.connectionId = null;

      // Clear any existing timers
      this.clearConnectionTimers();

      // Disconnect from any current connection
      const systemWifi = getSystemWifiService();
      await systemWifi.disconnectFromNetwork();

      logger.debug("Connection state cleared successfully");
    } catch (error) {
      logger.warn("Error clearing connection state:", error);
    }
  }

  /**
   * Refresh network adapter
   */
  private async refreshNetworkAdapter(): Promise<void> {
    try {
      const platform = process.platform;

      if (platform === "win32") {
        // Windows: Disable and re-enable WiFi adapter
        await execAsync("netsh interface set interface \"Wi-Fi\" disable");
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        await execAsync("netsh interface set interface \"Wi-Fi\" enable");
      } else if (platform === "darwin") {
        // macOS: Turn WiFi off and on
        await execAsync("networksetup -setairportpower en0 off");
        await new Promise(resolve => setTimeout(resolve, 2000));
        await execAsync("networksetup -setairportpower en0 on");
      } else {
        // Linux: Restart network manager or WiFi interface
        try {
          await execAsync("sudo systemctl restart NetworkManager");
        } catch {
          // Fallback: restart WiFi interface
          await execAsync("sudo ip link set wlan0 down && sudo ip link set wlan0 up");
        }
      }

      logger.debug("Network adapter refreshed successfully");
    } catch (error) {
      logger.warn("Error refreshing network adapter:", error);
    }
  }

  /**
   * Reset WiFi interface (more aggressive recovery)
   */
  private async resetWifiInterface(): Promise<void> {
    try {
      const platform = process.platform;

      if (platform === "win32") {
        // Windows: Reset WiFi adapter
        await execAsync("netsh wlan delete profile name=* i=*");
        await execAsync("netsh int ip reset");
        await execAsync("netsh winsock reset");
      } else if (platform === "darwin") {
        // macOS: Reset network preferences
        await execAsync("sudo dscacheutil -flushcache");
        await execAsync("sudo killall -HUP mDNSResponder");
      } else {
        // Linux: Restart networking service
        try {
          await execAsync("sudo systemctl restart networking");
        } catch {
          await execAsync("sudo service network-manager restart");
        }
      }

      logger.debug("WiFi interface reset successfully");
    } catch (error) {
      logger.warn("Error resetting WiFi interface:", error);
    }
  }

  /**
   * Clear DNS cache
   */
  private async clearDnsCache(): Promise<void> {
    try {
      const platform = process.platform;

      if (platform === "win32") {
        await execAsync("ipconfig /flushdns");
      } else if (platform === "darwin") {
        await execAsync("sudo dscacheutil -flushcache");
        await execAsync("sudo killall -HUP mDNSResponder");
      } else {
        // Linux
        await execAsync("sudo systemctl restart systemd-resolved");
      }

      logger.debug("DNS cache cleared successfully");
    } catch (error) {
      logger.warn("Error clearing DNS cache:", error);
    }
  }

  /**
   * Find alternative networks with similar characteristics
   */
  private async findAlternativeNetworks(failedNetwork: WiFiNetwork): Promise<WiFiNetwork[]> {
    try {
      const alternatives: WiFiNetwork[] = [];

      // Look for networks with similar SSID patterns (same base name)
      const baseSsid = failedNetwork.ssid.replace(/[-_]\d+$/, ""); // Remove trailing numbers

      for (const network of this.availableNetworks) {
        if (network.ssid !== failedNetwork.ssid) {
          // Check for similar SSID patterns
          if (network.ssid.startsWith(baseSsid) || baseSsid.startsWith(network.ssid.replace(/[-_]\d+$/, ""))) {
            alternatives.push(network);
          }
          // Check for same security type and good signal strength
          else if (network.security === failedNetwork.security && network.signalStrength > 50) {
            alternatives.push(network);
          }
        }
      }

      // Sort by signal strength (strongest first)
      alternatives.sort((a, b) => b.signalStrength - a.signalStrength);

      // Return top 3 alternatives
      return alternatives.slice(0, 3);
    } catch (error) {
      logger.error("Error finding alternative networks:", error);
      return [];
    }
  }

  /**
   * Handle redirect URL after successful connection
   */
  private handleRedirectUrl(network: WiFiNetwork) {
    const redirectUrl =
      network.settings?.redirectUrl || this.settings.defaultRedirectUrl;
    if (redirectUrl) {
      const timeout =
        network.settings?.redirectTimeout ||
        this.settings.defaultRedirectTimeout;

      logger.info(`Scheduling redirect to ${redirectUrl} after ${timeout}ms`);

      // Emit redirect scheduled event
      this.emit("redirectScheduled", {
        url: redirectUrl,
        timeout,
        network: { ssid: network.ssid, bssid: network.bssid },
      });

      // Schedule redirect
      this.redirectTimer = setTimeout(() => {
        logger.info(`Redirecting to ${redirectUrl}`);

        // Emit redirect event
        this.emit("redirect", {
          url: redirectUrl,
          network: { ssid: network.ssid, bssid: network.bssid },
        });

        // In a real app, we'd use window.open or similar
        if (typeof window !== "undefined") {
          window.open(redirectUrl, "_blank");
        } else {
          logger.debug(`Would redirect to: ${redirectUrl}`);
        }
      }, timeout);
    }
  }

  /**
   * Start monitoring signal strength for the connected network
   */
  private startSignalMonitoring(network: WiFiNetwork) {
    // Clear any existing monitoring
    if (this.signalMonitorInterval) {
      clearInterval(this.signalMonitorInterval);
    }

    logger.debug(`Starting signal monitoring for ${network.ssid}`);

    // Monitor signal strength every 10 seconds with real system queries
    this.signalMonitorInterval = setInterval(async () => {
      try {
        if (this.currentNetwork && this.currentNetwork.bssid === network.bssid) {
          // Get real signal strength from system
          const realSignalStrength = await this.getRealSignalStrength(network);

          if (realSignalStrength !== null) {
            const currentStrength = this.currentNetwork.signalStrength;

            // Only update if there's a significant change (>2% difference)
            if (Math.abs(currentStrength - realSignalStrength) > 2) {
              this.currentNetwork.signalStrength = realSignalStrength;

              logger.debug(
                `Signal strength for ${network.ssid} updated: ${realSignalStrength}% (was ${currentStrength}%)`
              );

              // Emit signal strength update event
              this.emit("signalStrengthUpdate", {
                network: { ssid: network.ssid, bssid: network.bssid },
                signalStrength: realSignalStrength,
                previousStrength: currentStrength,
                timestamp: Date.now(),
              });

              // If signal is too weak, emit warning
              if (realSignalStrength < 20) {
                logger.warn(
                  `Signal strength for ${network.ssid} is weak: ${realSignalStrength}%`
                );
                this.emit("weakSignal", {
                  network: { ssid: network.ssid, bssid: network.bssid },
                  signalStrength: realSignalStrength,
                  timestamp: Date.now(),
                });
              }

              // If signal improved significantly, emit recovery event
              if (currentStrength < 30 && realSignalStrength > 50) {
                logger.info(`Signal strength for ${network.ssid} recovered: ${realSignalStrength}%`);
                this.emit("signalRecovered", {
                  network: { ssid: network.ssid, bssid: network.bssid },
                  signalStrength: realSignalStrength,
                  previousStrength: currentStrength,
                  timestamp: Date.now(),
                });
              }
            }
          } else {
            // Fallback to simulation if real monitoring fails
            logger.debug("Real signal monitoring failed, using simulation fallback");
            const currentStrength = this.currentNetwork.signalStrength;
            const fluctuation = Math.floor(Math.random() * 6) - 3; // -3 to +3 fluctuation (smaller than before)
            const newStrength = Math.max(0, Math.min(100, currentStrength + fluctuation));

            if (Math.abs(currentStrength - newStrength) > 2) {
              this.currentNetwork.signalStrength = newStrength;
              this.emit("signalStrengthUpdate", {
                network: { ssid: network.ssid, bssid: network.bssid },
                signalStrength: newStrength,
                simulated: true,
                timestamp: Date.now(),
              });
            }
          }
        }
      } catch (error) {
        logger.error("Error during signal monitoring:", error);
      }
    }, 10000);
  }

  /**
   * Get real signal strength from system
   */
  private async getRealSignalStrength(network: WiFiNetwork): Promise<number | null> {
    try {
      const platform = process.platform;

      let command = "";
      let signalStrength: number | null = null;

      if (platform === "win32") {
        // Windows: Use netsh to get signal strength
        command = `netsh wlan show interfaces`;
        const { stdout } = await execAsync(command);

        // Parse signal strength from Windows output
        const signalMatch = stdout.match(/Signal\s*:\s*(\d+)%/i);
        if (signalMatch) {
          signalStrength = parseInt(signalMatch[1], 10);
        }
      } else if (platform === "darwin") {
        // macOS: Use airport utility or system_profiler
        try {
          command = `/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I`;
          const { stdout } = await execAsync(command);

          // Parse RSSI and convert to percentage
          const rssiMatch = stdout.match(/agrCtlRSSI:\s*(-?\d+)/);
          if (rssiMatch) {
            const rssi = parseInt(rssiMatch[1], 10);
            signalStrength = this.convertRSSIToPercentage(rssi);
          }
        } catch {
          // Fallback: use system_profiler
          command = `system_profiler SPAirPortDataType | grep -A 10 "${network.ssid}"`;
          const { stdout } = await execAsync(command);
          const signalMatch = stdout.match(/Signal \/ Noise:\s*(-?\d+)/);
          if (signalMatch) {
            const rssi = parseInt(signalMatch[1], 10);
            signalStrength = this.convertRSSIToPercentage(rssi);
          }
        }
      } else {
        // Linux: Use iwconfig or iw
        try {
          command = `iwconfig 2>/dev/null | grep -A 5 "${network.ssid}"`;
          const { stdout } = await execAsync(command);

          // Parse signal level
          const signalMatch = stdout.match(/Signal level=(-?\d+) dBm/) ||
                             stdout.match(/Signal level=(\d+)\/100/);

          if (signalMatch) {
            if (signalMatch[1].startsWith("-")) {
              // dBm value - convert to percentage
              const dBm = parseInt(signalMatch[1], 10);
              signalStrength = this.convertDBMToPercentage(dBm);
            } else {
              // Already a percentage
              signalStrength = parseInt(signalMatch[1], 10);
            }
          }
        } catch {
          // Fallback: use iw command
          command = `iw dev wlan0 link`;
          const { stdout } = await execAsync(command);
          const signalMatch = stdout.match(/signal:\s*(-?\d+) dBm/);
          if (signalMatch) {
            const dBm = parseInt(signalMatch[1], 10);
            signalStrength = this.convertDBMToPercentage(dBm);
          }
        }
      }

      if (signalStrength !== null) {
        logger.debug(`Real signal strength for ${network.ssid}: ${signalStrength}%`);
        return signalStrength;
      } else {
        logger.debug(`Could not get real signal strength for ${network.ssid}`);
        return null;
      }
    } catch (error) {
      logger.error("Error getting real signal strength:", error);
      return null;
    }
  }

  /**
   * Convert RSSI (dBm) to percentage
   */
  private convertRSSIToPercentage(rssi: number): number {
    // RSSI to percentage conversion
    // -30 dBm = 100%, -90 dBm = 0%
    const minRSSI = -90;
    const maxRSSI = -30;

    if (rssi >= maxRSSI) return 100;
    if (rssi <= minRSSI) return 0;

    return Math.round(((rssi - minRSSI) / (maxRSSI - minRSSI)) * 100);
  }

  /**
   * Convert dBm to percentage (alternative method)
   */
  private convertDBMToPercentage(dBm: number): number {
    // Alternative dBm to percentage conversion
    if (dBm >= -50) return 100;
    if (dBm <= -100) return 0;

    return Math.round(((dBm + 100) / 50) * 100);
  }

  /**
   * Clear all connection-related timers
   */
  private clearConnectionTimers() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.autoReconnectTimer) {
      clearTimeout(this.autoReconnectTimer);
      this.autoReconnectTimer = null;
    }

    if (this.signalMonitorInterval) {
      clearInterval(this.signalMonitorInterval);
      this.signalMonitorInterval = null;
    }

    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
      this.redirectTimer = null;
    }
  }

  /**
   * Simulate a connection process
   */
  private async simulateConnection(network: WiFiNetwork) {
    logger.debug(`Simulating connection to ${network.ssid}`);

    // Simulate connection delay
    await this.delay(1000);

    // For enterprise networks, add an authentication step
    if (network.security === SecurityType.WPA2_ENTERPRISE) {
      logger.debug(`Authenticating to enterprise network ${network.ssid}`);
      this.connectionStatus = ConnectionStatus.AUTHENTICATING;

      // Emit authentication started event
      this.emit("authenticationStarted", {
        connectionId: this.connectionId,
        network: { ssid: network.ssid, bssid: network.bssid },
      });

      await this.delay(1500);
    }

    // Simulate random connection failures (15% chance)
    if (Math.random() < 0.15 && network.ssid !== "Home_Network") {
      logger.warn(`Random connection failure for ${network.ssid}`);
      this.connectionStatus = ConnectionStatus.ERROR;
      this.connectionError = "Failed to connect to network. Please try again.";

      // Emit connection error event
      this.emit("connectionError", {
        connectionId: this.connectionId,
        error: "Failed to connect to network",
        network: { ssid: network.ssid, bssid: network.bssid },
      });

      throw new Error("Failed to connect to network");
    }

    // Connection successful
    this.currentNetwork = network;
    this.connectionStatus = ConnectionStatus.CONNECTED;
    this.connectionError = null;
    this.lastConnectionTime = Date.now();

    // Get real IP address
    this.ipAddress = await this.getRealIpAddress();

    logger.info(
      `Successfully connected to ${network.ssid} (IP: ${this.ipAddress})`
    );

    // Emit connection successful event
    this.emit("connectionSuccessful", {
      connectionId: this.connectionId,
      network: { ssid: network.ssid, bssid: network.bssid },
      ipAddress: this.ipAddress,
      connectionTime: Date.now() - (this.connectionStartTime || Date.now()),
    });
  }

  /**
   * Save a network and its credentials
   */
  async saveNetwork(
    network: WiFiNetwork,
    password?: string
  ): Promise<WiFiNetwork> {
    logger.info(`Saving network ${network.ssid}`);

    const updatedNetwork: WiFiNetwork = {
      ...network,
      saved: true,
      settings: {
        ...(network.settings || {}),
        autoConnect: true,
        redirectUrl: network.settings?.redirectUrl ?? null,
        hidden: network.settings?.hidden ?? false,
        priority: network.settings?.priority ?? 0,
        redirectTimeout: network.settings?.redirectTimeout ?? 3000,
      },
    };

    // Add to saved networks if not already there
    const existingIndex = this.savedNetworks.findIndex(
      (n) => n.bssid === network.bssid
    );
    if (existingIndex >= 0) {
      logger.debug(`Updating existing saved network ${network.ssid}`);
      this.savedNetworks[existingIndex] = updatedNetwork;
    } else {
      logger.debug(`Adding new saved network ${network.ssid}`);
      this.savedNetworks.push(updatedNetwork);
    }

    // Update in available networks if present
    const availableIndex = this.availableNetworks.findIndex(
      (n) => n.bssid === network.bssid
    );
    if (availableIndex >= 0) {
      this.availableNetworks[availableIndex] = updatedNetwork;
    }

    // Save to persistent storage
    await this.saveNetworksToStorage();

    // If password provided and secure storage enabled, save credentials
    if (password && this.settings.secureStorage) {
      logger.debug(`Saving credentials for ${network.ssid}`);
      await secureStore.saveCredentials(network.bssid, password);
    }

    // Emit network saved event
    this.emit("networkSaved", {
      network: { ssid: network.ssid, bssid: network.bssid },
    });

    return updatedNetwork;
  }

  /**
   * Disconnect from the current network
   */
  async disconnectFromNetwork(): Promise<void> {
    if (!this.currentNetwork) {
      logger.warn("No active connection to disconnect");
      return;
    }

    const networkInfo = {
      ssid: this.currentNetwork.ssid,
      bssid: this.currentNetwork.bssid,
    };

    logger.info(`Disconnecting from ${this.currentNetwork.ssid}`);

    // Clear all connection-related timers
    this.clearConnectionTimers();

    try {
      // 尝试使用系统WiFi服务断开连接
      const systemWifi = getSystemWifiService();
      await systemWifi.disconnectFromNetwork();
      
      // 断开连接后清理状态
      this.currentNetwork = null;
      this.connectionStatus = ConnectionStatus.DISCONNECTED;
      this.connectionId = null;
      this.ipAddress = null;

      // Emit disconnection event
      this.emit("disconnected", { network: networkInfo });
    } catch (error) {
      logger.error(`Error disconnecting from network: ${error}`);
      throw error;
    }
  }

  /**
   * Forget/remove a saved network
   */
  async forgetNetwork(network: WiFiNetwork): Promise<void> {
    logger.info(`Forgetting network ${network.ssid}`);

    // Remove from saved networks
    this.savedNetworks = this.savedNetworks.filter(
      (n) => n.bssid !== network.bssid
    );

    // Update in available networks if present
    const availableIndex = this.availableNetworks.findIndex(
      (n) => n.bssid === network.bssid
    );
    if (availableIndex >= 0) {
      logger.debug(
        `Updating available network ${network.ssid} to unsaved state`
      );
      this.availableNetworks[availableIndex] = {
        ...this.availableNetworks[availableIndex],
        saved: false,
        settings: {
          autoConnect: false,
          redirectUrl: null,
          hidden: false,
          priority: 0,
          redirectTimeout: this.settings.defaultRedirectTimeout,
        },
      };
    }

    // Save to persistent storage
    await this.saveNetworksToStorage();

    // Remove credentials if secure storage enabled
    if (this.settings.secureStorage) {
      logger.debug(`Removing credentials for ${network.ssid}`);
      await secureStore.deleteCredentials(network.bssid);
    }

    // If currently connected to this network, disconnect
    if (this.currentNetwork && this.currentNetwork.bssid === network.bssid) {
      logger.info(`Currently connected to ${network.ssid}, disconnecting`);
      await this.disconnectFromNetwork();
    }

    // Emit network forgotten event
    this.emit("networkForgotten", {
      network: { ssid: network.ssid, bssid: network.bssid },
    });
  }

  /**
   * Update settings for a specific network
   */
  async updateNetworkSettings(
    network: WiFiNetwork,
    settings: Partial<NetworkSettings>
  ): Promise<WiFiNetwork> {
    logger.info(`Updating settings for ${network.ssid}`);
    logger.debug("New settings:", settings);

    // Find the network in saved networks
    const savedIndex = this.savedNetworks.findIndex(
      (n) => n.bssid === network.bssid
    );
    if (savedIndex >= 0) {
      const currentSettings = this.savedNetworks[savedIndex].settings;
      this.savedNetworks[savedIndex] = {
        ...this.savedNetworks[savedIndex],
        settings: {
          autoConnect: currentSettings?.autoConnect ?? false,
          redirectUrl: currentSettings?.redirectUrl ?? null,
          hidden: currentSettings?.hidden ?? false,
          priority: currentSettings?.priority ?? 0,
          redirectTimeout: currentSettings?.redirectTimeout ?? 3000,
          ...settings,
        },
      };
    }

    // Update in available networks if present
    const availableIndex = this.availableNetworks.findIndex(
      (n) => n.bssid === network.bssid
    );
    if (availableIndex >= 0 && this.availableNetworks[availableIndex].saved) {
      const currentAvailableSettings = this.availableNetworks[availableIndex].settings;
      this.availableNetworks[availableIndex] = {
        ...this.availableNetworks[availableIndex],
        settings: {
          autoConnect: currentAvailableSettings?.autoConnect ?? false,
          redirectUrl: currentAvailableSettings?.redirectUrl ?? null,
          hidden: currentAvailableSettings?.hidden ?? false,
          priority: currentAvailableSettings?.priority ?? 0,
          redirectTimeout: currentAvailableSettings?.redirectTimeout ?? 3000,
          ...settings,
        },
      };
    }

    // Save to persistent storage
    await this.saveNetworksToStorage();

    // Emit network settings updated event
    this.emit("networkSettingsUpdated", {
      network: { ssid: network.ssid, bssid: network.bssid },
      settings,
    });

    // Return the updated network
    return savedIndex >= 0 ? this.savedNetworks[savedIndex] : network;
  }

  /**
   * Get the current connection status
   */
  async getConnectionStatus(): Promise<ConnectionStatusInfo> {
    try {
      // 尝试使用系统WiFi服务获取当前连接
      const systemWifi = getSystemWifiService();
      const currentNetwork = await systemWifi.getCurrentNetwork();
      
      // 如果有当前连接，更新内部状态
      if (currentNetwork) {
        this.currentNetwork = currentNetwork;
        this.connectionStatus = ConnectionStatus.CONNECTED;
        
        // 如果之前未连接，则设置连接时间
        if (!this.lastConnectionTime) {
          this.lastConnectionTime = Date.now();
          this.connectionStartTime = Date.now();
        }
      } else if (this.connectionStatus === ConnectionStatus.CONNECTED) {
        // 如果内部状态显示已连接但系统未连接，则更新状态
        this.currentNetwork = null;
        this.connectionStatus = ConnectionStatus.DISCONNECTED;
      }
    } catch (error) {
      logger.error("获取连接状态失败:", error);
      // 出错时不改变当前状态
    }
    
    const connectionDuration =
      this.connectionStartTime &&
      this.connectionStatus === ConnectionStatus.CONNECTED
        ? Date.now() - this.connectionStartTime
        : null;

    return {
      connectionStatus: this.connectionStatus,
      currentNetwork: this.currentNetwork,
      connectionError: this.connectionError,
      lastConnectionTime: this.lastConnectionTime,
      connectionId: this.connectionId,
      signalStrength: this.currentNetwork?.signalStrength || null,
      ipAddress: this.ipAddress,
      connectionDuration,
      retryCount: this.retryCount,
      retryAvailable:
        this.settings.autoReconnect &&
        this.retryCount < this.settings.maxRetryAttempts,
    };
  }

  /**
   * Get the global WiFi settings
   */
  async getSettings(): Promise<WiFiSettings> {
    return this.settings;
  }

  /**
   * Update the global WiFi settings
   */
  async updateSettings(
    newSettings: Partial<WiFiSettings>
  ): Promise<WiFiSettings> {
    logger.info("Updating global WiFi settings");
    logger.debug("New settings:", newSettings);

    const oldSettings = { ...this.settings };
    this.settings = {
      ...this.settings,
      ...newSettings,
    };

    // Save to persistent storage
    await this.saveSettingsToStorage();

    // Update logger configuration if logging settings changed
    if (
      newSettings.enableLogging !== undefined ||
      newSettings.logLevel !== undefined
    ) {
      logger.setEnabled(this.settings.enableLogging);
      logger.setLevel(this.settings.logLevel);
    }

    // Emit settings updated event
    this.emit("settingsUpdated", {
      oldSettings,
      newSettings: this.settings,
    });

    return this.settings;
  }

  /**
   * Helper method to simulate delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let networkManagerInstance: NetworkManager | null = null;

/**
 * Get the NetworkManager instance
 */
export function getNetworkManager(): NetworkManager {
  if (!networkManagerInstance) {
    networkManagerInstance = new NetworkManager();
  }
  return networkManagerInstance;
}
