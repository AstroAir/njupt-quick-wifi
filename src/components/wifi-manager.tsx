"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NetworkList } from "@/components/network-list";
import { SavedNetworks } from "@/components/saved-networks";
import { ConnectionStatus as ConnectionStatusComponent } from "@/components/connection-status";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, SettingsIcon, FilterIcon } from "lucide-react";
import { useWifiStore } from "@/store";
import { toast } from "sonner";
import { Settings } from "@/components/settings";
import { NetworkFilters } from "@/components/network-filters";
import { motion, AnimatePresence } from "framer-motion";
import type { WiFiNetwork } from "@/types";

export function WifiManager() {
  const [showFilters, setShowFilters] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const {
    savedNetworks,
    currentNetwork,
    connectionStatus,
    connectionError,
    isScanning,
    scanProgress,
    lastScanTime,
    scanNetworks,
    connectToNetwork,
    disconnectFromNetwork,
    forgetNetwork,
    updateNetworkSettings,
    autoScanOnStartup,
    animationsEnabled,
    getFilteredNetworks,
  } = useWifiStore();

  const filteredNetworks = getFilteredNetworks();

  // Initial network scan with animation
  useEffect(() => {
    if (autoScanOnStartup) {
      const timer = setTimeout(() => {
        scanNetworks();
        setIsInitialLoad(false);
      }, 1000); // Delay initial scan for opening animation

      return () => clearTimeout(timer);
    } else {
      setIsInitialLoad(false);
    }
  }, [autoScanOnStartup, scanNetworks]);

  // Show toast for connection errors
  useEffect(() => {
    if (connectionError) {
      toast.error(connectionError);
    }
  }, [connectionError]);

  // Auto-refresh scan at interval if enabled
  useEffect(() => {
    const scanInterval = useWifiStore.getState().scanInterval;
    if (scanInterval > 0) {
      const intervalId = setInterval(() => {
        // Only scan if not already scanning and not in the middle of connecting
        if (
          !isScanning &&
          connectionStatus !== "connecting" &&
          connectionStatus !== "authenticating"
        ) {
          scanNetworks();
        }
      }, scanInterval);

      return () => clearInterval(intervalId);
    }
  }, [isScanning, connectionStatus, scanNetworks]);

  const handleConnect = async (network: WiFiNetwork, password?: string) => {
    const success = await connectToNetwork(network, password);

    if (success) {
      toast.success(`Successfully connected to ${network.ssid}`);
    }
  };

  const handleDisconnect = () => {
    disconnectFromNetwork();
    toast.info("You have been disconnected from the network");
  };

  const handleForget = (network: WiFiNetwork) => {
    forgetNetwork(network);
    toast.success(`${network.ssid} has been removed from saved networks`);
  };

  const formatLastScanTime = () => {
    if (!lastScanTime) return null;

    const seconds = Math.floor((Date.now() - lastScanTime) / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    return `${Math.floor(seconds / 3600)} hours ago`;
  };

  return (
    <AnimatePresence>
      <motion.div
        className="bg-white rounded-lg shadow-md overflow-hidden"
        initial={animationsEnabled ? { opacity: 0, y: 20 } : undefined}
        animate={animationsEnabled ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.div
          className="p-4 border-b"
          initial={animationsEnabled ? { opacity: 0 } : undefined}
          animate={animationsEnabled ? { opacity: 1 } : undefined}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <ConnectionStatusComponent
            currentNetwork={currentNetwork}
            status={connectionStatus}
            onDisconnect={handleDisconnect}
            animated={animationsEnabled}
          />
        </motion.div>

        <Tabs defaultValue="available" className="w-full">
          <div className="px-4 pt-3 flex justify-between items-center">
            <TabsList className="flex-1 max-w-md">
              <TabsTrigger value="available" className="flex-1">
                Available Networks
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex-1">
                Saved Networks
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex-1">
                <SettingsIcon className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="available" className="p-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-medium">Available Networks</h2>
                {lastScanTime && (
                  <p className="text-xs text-muted-foreground">
                    Last scan: {formatLastScanTime()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <FilterIcon className="h-4 w-4 mr-2" />
                  Filter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => scanNetworks()}
                  disabled={isScanning}
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Scanning... {scanProgress}%
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Scan
                    </>
                  )}
                </Button>
              </div>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={
                    animationsEnabled ? { opacity: 0, height: 0 } : undefined
                  }
                  animate={
                    animationsEnabled
                      ? { opacity: 1, height: "auto" }
                      : undefined
                  }
                  exit={
                    animationsEnabled ? { opacity: 0, height: 0 } : undefined
                  }
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden mb-4"
                >
                  <NetworkFilters />
                </motion.div>
              )}
            </AnimatePresence>

            <NetworkList
              networks={filteredNetworks}
              currentNetwork={currentNetwork}
              connectionStatus={connectionStatus}
              onConnect={handleConnect}
              onForget={handleForget}
              isScanning={isScanning}
              animated={animationsEnabled}
              isInitialLoad={isInitialLoad}
            />
          </TabsContent>

          <TabsContent value="saved" className="p-4">
            <SavedNetworks
              networks={savedNetworks}
              currentNetwork={currentNetwork}
              connectionStatus={connectionStatus}
              onConnect={handleConnect}
              onForget={handleForget}
              onUpdateSettings={updateNetworkSettings}
              animated={animationsEnabled}
            />
          </TabsContent>

          <TabsContent value="settings" className="p-4">
            <Settings />
          </TabsContent>
        </Tabs>
      </motion.div>
    </AnimatePresence>
  );
}
