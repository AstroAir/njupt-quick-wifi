import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  NetworkType,
  type WiFiNetwork,
  ConnectionStatus,
  SecurityType,
} from "@/types";

interface NetworkState {
  availableNetworks: WiFiNetwork[];
  savedNetworks: WiFiNetwork[];
  currentNetwork: WiFiNetwork | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  isScanning: boolean;
  scanProgress: number;
  lastScanTime: number | null;
}

interface NetworkActions {
  scanNetworks: () => Promise<void>;
  connectToNetwork: (
    network: WiFiNetwork,
    password?: string
  ) => Promise<boolean>;
  disconnectFromNetwork: () => void;
  forgetNetwork: (network: WiFiNetwork) => void;
  saveNetwork: (network: WiFiNetwork, autoConnect?: boolean) => void;
  updateNetworkSettings: (
    network: WiFiNetwork,
    settings: Partial<NetworkSettings>
  ) => void;
  // 新增的状态更新接口
  setAvailableNetworks: (networks: WiFiNetwork[]) => void;
  setSavedNetworks: (networks: WiFiNetwork[]) => void;
  setCurrentNetwork: (network: WiFiNetwork | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setConnectionError: (error: string | null) => void;
  setIsScanning: (isScanning: boolean) => void;
  setScanProgress: (progress: number) => void;
  setLastScanTime: (time: number) => void;
}

interface FilterState {
  searchQuery: string;
  securityFilter: SecurityType | null;
  sortBy: "signal" | "name" | "security";
  sortDirection: "asc" | "desc";
  showOnlySaved: boolean;
  showOnlyAvailable: boolean;
}

interface FilterActions {
  setSearchQuery: (query: string) => void;
  setSecurityFilter: (type: SecurityType | null) => void;
  setSortBy: (sortBy: "signal" | "name" | "security") => void;
  setSortDirection: (direction: "asc" | "desc") => void;
  setShowOnlySaved: (show: boolean) => void;
  setShowOnlyAvailable: (show: boolean) => void;
  resetFilters: () => void;
}

interface NetworkSettings {
  autoConnect: boolean;
  redirectUrl: string | null;
  hidden: boolean;
  priority: number;
  redirectTimeout: number;
}

interface SettingsState {
  defaultRedirectUrl: string | null;
  autoScanOnStartup: boolean;
  autoReconnect: boolean;
  secureStorage: boolean;
  defaultRedirectTimeout: number;
  scanInterval: number;
  animationsEnabled: boolean;
  darkMode: boolean | null;
  isOffline: boolean;
}

interface SettingsActions {
  updateSettings: (settings: Partial<SettingsState>) => void;
}

interface WifiStore
  extends NetworkState,
    NetworkActions,
    FilterState,
    FilterActions,
    SettingsState,
    SettingsActions {
  getFilteredNetworks: () => WiFiNetwork[];
}

// Helper function to simulate network operations with delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to filter networks based on criteria
const filterNetworks = (
  networks: WiFiNetwork[],
  searchQuery: string,
  securityFilter: SecurityType | null,
  showOnlySaved: boolean,
  showOnlyAvailable: boolean
) => {
  return networks.filter((network) => {
    // Filter by search query
    if (
      searchQuery &&
      !network.ssid.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Filter by security type
    if (securityFilter && network.security !== securityFilter) {
      return false;
    }

    // Filter by saved status
    if (showOnlySaved && !network.saved) {
      return false;
    }

    // Filter by availability (signal strength > 0)
    if (showOnlyAvailable && network.signalStrength <= 0) {
      return false;
    }

    return true;
  });
};

// Helper to sort networks
const sortNetworks = (
  networks: WiFiNetwork[],
  sortBy: "signal" | "name" | "security",
  sortDirection: "asc" | "desc"
) => {
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
};

export const useWifiStore = create<WifiStore>()(
  persist(
    (set, get) => ({
      // Network State
      availableNetworks: [],
      savedNetworks: [],
      currentNetwork: null,
      connectionStatus: ConnectionStatus.DISCONNECTED,
      connectionError: null,
      isScanning: false,
      scanProgress: 0,
      lastScanTime: null,

      // Filter State
      searchQuery: "",
      securityFilter: null,
      sortBy: "signal",
      sortDirection: "desc",
      showOnlySaved: false,
      showOnlyAvailable: true,

      // Settings State
      defaultRedirectUrl: null,
      autoScanOnStartup: true,
      autoReconnect: true,
      secureStorage: true,
      defaultRedirectTimeout: 3000,
      scanInterval: 30000, // 30 seconds
      animationsEnabled: true,
      darkMode: null,
      isOffline: false,

      // 新增的状态更新接口
      setAvailableNetworks: (networks) => set({ availableNetworks: networks }),
      setSavedNetworks: (networks) => set({ savedNetworks: networks }),
      setCurrentNetwork: (network) => set({ currentNetwork: network }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      setConnectionError: (error) => set({ connectionError: error }),
      setIsScanning: (isScanning) => set({ isScanning }),
      setScanProgress: (progress) => set({ scanProgress: progress }),
      setLastScanTime: (time) => set({ lastScanTime: time }),

      // Selectors
      getFilteredNetworks: () => {
        const {
          availableNetworks,
          searchQuery,
          securityFilter,
          sortBy,
          sortDirection,
          showOnlySaved,
          showOnlyAvailable,
        } = get();

        const filtered = filterNetworks(
          availableNetworks,
          searchQuery,
          securityFilter,
          showOnlySaved,
          showOnlyAvailable
        );

        return sortNetworks(filtered, sortBy, sortDirection);
      },

      // Filter Actions
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSecurityFilter: (type) => set({ securityFilter: type }),
      setSortBy: (sortBy) => set({ sortBy }),
      setSortDirection: (sortDirection) => set({ sortDirection }),
      setShowOnlySaved: (show) => set({ showOnlySaved: show }),
      setShowOnlyAvailable: (show) => set({ showOnlyAvailable: show }),
      resetFilters: () =>
        set({
          searchQuery: "",
          securityFilter: null,
          sortBy: "signal",
          sortDirection: "desc",
          showOnlySaved: false,
          showOnlyAvailable: true,
        }),

      // Network Actions
      scanNetworks: async () => {
        set({ isScanning: true, scanProgress: 0, connectionError: null });

        // Simulate progressive scanning with more steps for smoother animation
        for (let i = 1; i <= 10; i++) {
          await delay(300);
          set({ scanProgress: i * 10 });
        }

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
        const { savedNetworks } = get();
        const allNetworks = [...mockNetworks, ...randomNetworks];
        const networksWithSavedStatus = allNetworks.map((network) => {
          const savedNetwork = savedNetworks.find(
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

        set({
          availableNetworks: networksWithSavedStatus,
          isScanning: false,
          scanProgress: 100,
          lastScanTime: Date.now(),
        });
      },

      connectToNetwork: async (network: WiFiNetwork, password?: string) => {
        const { savedNetworks } = get();

        // Check if password is required but not provided
        if (
          network.security !== SecurityType.OPEN &&
          !password &&
          !savedNetworks.find((n) => n.bssid === network.bssid)
        ) {
          set({ connectionError: "Password required for this network" });
          return false;
        }

        set({
          connectionStatus: ConnectionStatus.CONNECTING,
          connectionError: null,
        });

        // Simulate connection process with more detailed states
        await delay(1000);

        // For enterprise networks, add an authentication step
        if (network.security === SecurityType.WPA2_ENTERPRISE) {
          set({ connectionStatus: ConnectionStatus.AUTHENTICATING });
          await delay(1500);
        }

        // Simulate random connection failures (15% chance)
        if (Math.random() < 0.15 && network.ssid !== "Home_Network") {
          set({
            connectionStatus: ConnectionStatus.ERROR,
            connectionError: "Failed to connect to network. Please try again.",
          });

          // Reset to disconnected after a delay
          setTimeout(() => {
            set({ connectionStatus: ConnectionStatus.DISCONNECTED });
          }, 3000);

          return false;
        }

        // Connection successful
        set({
          currentNetwork: network,
          connectionStatus: ConnectionStatus.CONNECTED,
          connectionError: null,
        });

        // If this is a new network, add it to saved networks
        if (!network.saved) {
          const updatedNetwork = {
            ...network,
            saved: true,
            settings: {
              ...network.settings,
              autoConnect: true,
            },
          };

          set((state) => ({
            savedNetworks: [...state.savedNetworks, updatedNetwork],
            availableNetworks: state.availableNetworks.map((n) =>
              n.bssid === network.bssid ? updatedNetwork : n
            ),
          }));
        }

        // Handle redirect URL if configured
        const redirectUrl =
          network.settings?.redirectUrl || get().defaultRedirectUrl;
        if (redirectUrl) {
          const timeout =
            network.settings?.redirectTimeout || get().defaultRedirectTimeout;

          // In a real app, we'd use window.open or similar
          console.log(`Redirecting to: ${redirectUrl} after ${timeout}ms`);

          // Simulate opening in a new tab
          setTimeout(() => {
            alert(`Redirecting to secondary login: ${redirectUrl}`);
          }, timeout);
        }

        return true;
      },

      disconnectFromNetwork: () => {
        set({
          currentNetwork: null,
          connectionStatus: ConnectionStatus.DISCONNECTED,
        });
      },

      forgetNetwork: (network: WiFiNetwork) => {
        const { currentNetwork } = get();

        set((state) => ({
          savedNetworks: state.savedNetworks.filter(
            (n) => n.bssid !== network.bssid
          ),
          availableNetworks: state.availableNetworks.map((n) =>
            n.bssid === network.bssid
              ? {
                  ...n,
                  saved: false,
                  settings: {
                    autoConnect: false,
                    redirectUrl: null,
                    hidden: false,
                    priority: 0,
                    redirectTimeout: state.defaultRedirectTimeout,
                  },
                }
              : n
          ),
        }));

        // If currently connected to this network, disconnect
        if (currentNetwork?.bssid === network.bssid) {
          set({
            currentNetwork: null,
            connectionStatus: ConnectionStatus.DISCONNECTED,
          });
        }
      },

      saveNetwork: (network: WiFiNetwork, autoConnect = true) => {
        const updatedNetwork = {
          ...network,
          saved: true,
          settings: {
            ...network.settings,
            autoConnect,
          },
        };

        set((state) => ({
          savedNetworks: [...state.savedNetworks, updatedNetwork],
          availableNetworks: state.availableNetworks.map((n) =>
            n.bssid === network.bssid ? updatedNetwork : n
          ),
        }));
      },

      updateNetworkSettings: (
        network: WiFiNetwork,
        settings: Partial<NetworkSettings>
      ) => {
        set((state) => ({
          savedNetworks: state.savedNetworks.map((n) =>
            n.bssid === network.bssid
              ? { ...n, settings: { ...n.settings, ...settings } }
              : n
          ),
          availableNetworks: state.availableNetworks.map((n) =>
            n.bssid === network.bssid && n.saved
              ? { ...n, settings: { ...n.settings, ...settings } }
              : n
          ),
        }));
      },

      // Settings Actions
      updateSettings: (settings: Partial<SettingsState>) => {
        set((state) => ({
          ...state,
          ...settings,
        }));
      },
    }),
    {
      name: "wifi-manager-storage",
      partialize: (state) => ({
        savedNetworks: state.savedNetworks,
        defaultRedirectUrl: state.defaultRedirectUrl,
        autoScanOnStartup: state.autoScanOnStartup,
        autoReconnect: state.autoReconnect,
        secureStorage: state.secureStorage,
        defaultRedirectTimeout: state.defaultRedirectTimeout,
        scanInterval: state.scanInterval,
        animationsEnabled: state.animationsEnabled,
        darkMode: state.darkMode,
      }),
    }
  )
);
