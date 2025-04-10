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
      filtered = filtered.filter(
        (n) => n.signalStrength >= filters.minSignalStrength
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

    if (this.isScanning) {
      logger.warn("Scan already in progress");
      throw new Error("Scan already in progress");
    }

    this.isScanning = true;
    this.scanProgress = 0;
    this.scanId = `scan_${Date.now()}`;
    this.scanStartTime = Date.now();
    this.scanDuration = null;

    // Emit scan started event
    this.emit("scanStarted", { scanId: this.scanId });

    try {
      // 获取系统WiFi服务
      const systemWifi = getSystemWifiService();
      
      // 通过系统WiFi服务启动扫描
      const success = await systemWifi.startScan();
      
      if (success) {
        // 实际扫描启动成功，但无法获取进度，所以模拟进度
        this.simulateScanProgress().catch((err) => {
          logger.error("Scan progress simulation failed", err);
        });
      } else {
        // 如果系统扫描失败，回退到模拟扫描
        logger.warn("System WiFi scan failed, falling back to simulated scan");
        this.simulateScan().catch((err) => {
          logger.error("Scan simulation failed", err);
          this.isScanning = false;
          this.emit("scanError", { error: err.message });
        });
      }
    } catch (error) {
      logger.error("Failed to start WiFi scan", error);
      this.isScanning = false;
      this.emit("scanError", { error: "Failed to start WiFi scan" });
      throw error;
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
    const randomNetworks = Array.from({ length: 5 }, (_, i) => ({
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
        await this.simulateConnection(network, password);
      } else {
        // 系统连接成功
        logger.info(`Successfully connected to ${network.ssid} using system WiFi`);
        
        // 获取当前连接的网络信息
        this.currentNetwork = await systemWifi.getCurrentNetwork() || network;
        this.connectionStatus = ConnectionStatus.CONNECTED;
        this.connectionError = null;
        this.lastConnectionTime = Date.now();
        
        // 模拟获取IP地址
        this.ipAddress = `192.168.1.${Math.floor(Math.random() * 254) + 1}`;
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
   * Handle connection retry logic
   */
  private handleConnectionRetry(
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

      // Emit retry scheduled event
      this.emit("retryScheduled", {
        connectionId: this.connectionId,
        retryCount: this.retryCount,
        maxRetries: this.settings.maxRetryAttempts,
        delay: this.settings.retryDelay,
        network: { ssid: network.ssid, bssid: network.bssid },
      });

      // Schedule retry
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

          // Simulate connection process
          await this.simulateConnection(network, password);

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
          this.handleConnectionRetry(network, password, saveNetwork);
        }
      }, this.settings.retryDelay);
    } else if (this.retryCount >= this.settings.maxRetryAttempts) {
      logger.warn(
        `Max retry attempts (${this.settings.maxRetryAttempts}) reached for ${network.ssid}`
      );

      // Emit max retries reached event
      this.emit("maxRetriesReached", {
        connectionId: this.connectionId,
        retryCount: this.retryCount,
        network: { ssid: network.ssid, bssid: network.bssid },
      });
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

    // Monitor signal strength every 10 seconds
    this.signalMonitorInterval = setInterval(() => {
      // In a real implementation, this would query the actual signal strength
      // For simulation, we'll randomly fluctuate the signal strength
      if (this.currentNetwork && this.currentNetwork.bssid === network.bssid) {
        const currentStrength = this.currentNetwork.signalStrength;
        const fluctuation = Math.floor(Math.random() * 10) - 5; // -5 to +5 fluctuation
        const newStrength = Math.max(
          0,
          Math.min(100, currentStrength + fluctuation)
        );

        // Only update if there's a significant change
        if (Math.abs(currentStrength - newStrength) > 2) {
          this.currentNetwork.signalStrength = newStrength;
          this.signalStrength = newStrength;

          logger.debug(
            `Signal strength for ${network.ssid} updated: ${newStrength}%`
          );

          // Emit signal strength update event
          this.emit("signalStrengthUpdate", {
            network: { ssid: network.ssid, bssid: network.bssid },
            signalStrength: newStrength,
          });

          // If signal is too weak, emit warning
          if (newStrength < 20) {
            logger.warn(
              `Signal strength for ${network.ssid} is weak: ${newStrength}%`
            );
            this.emit("weakSignal", {
              network: { ssid: network.ssid, bssid: network.bssid },
              signalStrength: newStrength,
            });
          }
        }
      }
    }, 10000);
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
  private async simulateConnection(network: WiFiNetwork, password?: string) {
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

    // Simulate getting an IP address
    this.ipAddress = `192.168.1.${Math.floor(Math.random() * 254) + 1}`;

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

    const updatedNetwork = {
      ...network,
      saved: true,
      settings: {
        ...network.settings,
        autoConnect: true,
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
      this.savedNetworks[savedIndex] = {
        ...this.savedNetworks[savedIndex],
        settings: {
          ...this.savedNetworks[savedIndex].settings,
          ...settings,
        },
      };
    }

    // Update in available networks if present
    const availableIndex = this.availableNetworks.findIndex(
      (n) => n.bssid === network.bssid
    );
    if (availableIndex >= 0 && this.availableNetworks[availableIndex].saved) {
      this.availableNetworks[availableIndex] = {
        ...this.availableNetworks[availableIndex],
        settings: {
          ...this.availableNetworks[availableIndex].settings,
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
