"use client";

import { useState } from "react";
import {
  Wifi,
  WifiOff,
  MoreVertical,
  Lock,
  ExternalLink,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { NetworkDetailsDialog } from "@/components/network-details-dialog";
import { NetworkSettingsDialog } from "@/components/network-settings-dialog";
import {
  ConnectionStatus,
  SecurityType,
  type WiFiNetwork,
  type NetworkSettings,
} from "@/types";
import { motion, AnimatePresence } from "framer-motion";

interface SavedNetworksProps {
  networks: WiFiNetwork[];
  currentNetwork: WiFiNetwork | null;
  connectionStatus: ConnectionStatus;
  onConnect: (network: WiFiNetwork) => void;
  onForget: (network: WiFiNetwork) => void;
  onUpdateSettings: (
    network: WiFiNetwork,
    settings: Partial<NetworkSettings>
  ) => void;
  animated: boolean;
}

export function SavedNetworks({
  networks,
  currentNetwork,
  connectionStatus,
  onConnect,
  onForget,
  onUpdateSettings,
  animated,
}: SavedNetworksProps) {
  const [selectedNetwork, setSelectedNetwork] = useState<WiFiNetwork | null>(
    null
  );
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const toggleAutoConnect = (network: WiFiNetwork) => {
    onUpdateSettings(network, {
      autoConnect: !(network.settings?.autoConnect ?? false),
    });
  };

  const handleViewDetails = (network: WiFiNetwork) => {
    setSelectedNetwork(network);
    setShowDetailsDialog(true);
  };

  const handleEditSettings = (network: WiFiNetwork) => {
    setSelectedNetwork(network);
    setShowSettingsDialog(true);
  };

  const handleSettingsUpdate = (settings: Partial<NetworkSettings>) => {
    if (selectedNetwork) {
      onUpdateSettings(selectedNetwork, settings);
      setShowSettingsDialog(false);
    }
  };

  const getSecurityIcon = (security: string) => {
    switch (security) {
      case SecurityType.WPA3:
        return (
          <Shield className="h-3 w-3 absolute -right-1 -bottom-1 text-green-600" />
        );
      case SecurityType.WPA2_ENTERPRISE:
        return (
          <Shield className="h-3 w-3 absolute -right-1 -bottom-1 text-blue-600" />
        );
      case SecurityType.OPEN:
        return null;
      default:
        return <Lock className="h-3 w-3 absolute -right-1 -bottom-1" />;
    }
  };

  return (
    <div className="space-y-4">
      <motion.h2
        className="text-lg font-medium"
        initial={animated ? { opacity: 0, y: -10 } : undefined}
        animate={animated ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.5 }}
      >
        Saved Networks
      </motion.h2>

      <AnimatePresence>
        {networks.length === 0 ? (
          <motion.div
            className="py-8 text-center text-muted-foreground"
            initial={animated ? { opacity: 0 } : undefined}
            animate={animated ? { opacity: 1 } : undefined}
            exit={animated ? { opacity: 0 } : undefined}
            transition={{ duration: 0.3 }}
          >
            <WifiOff className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No saved networks</p>
            <p className="text-sm">Connect to a network to save it</p>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {networks.map((network, index) => {
              const isConnected = currentNetwork?.bssid === network.bssid;
              const isConnecting =
                isConnected &&
                (connectionStatus === ConnectionStatus.CONNECTING ||
                  connectionStatus === ConnectionStatus.AUTHENTICATING);

              return (
                <motion.div
                  key={network.bssid}
                  className={`flex items-center justify-between p-3 rounded-md ${
                    isConnected ? "bg-primary/10" : "hover:bg-muted"
                  }`}
                  initial={animated ? { opacity: 0, y: 10 } : undefined}
                  animate={animated ? { opacity: 1, y: 0 } : undefined}
                  exit={animated ? { opacity: 0, height: 0 } : undefined}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.05,
                    ease: "easeOut",
                  }}
                  layout
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Wifi className="h-5 w-5" />
                      {getSecurityIcon(network.security)}
                    </div>

                    <div>
                      <div className="font-medium flex items-center">
                        {network.ssid}
                        {isConnected && (
                          <Badge className="ml-2 bg-green-100 text-green-800">
                            {connectionStatus === ConnectionStatus.CONNECTING
                              ? "Connecting..."
                              : connectionStatus ===
                                ConnectionStatus.AUTHENTICATING
                              ? "Authenticating..."
                              : "Connected"}
                          </Badge>
                        )}
                        {network.settings?.redirectUrl && (
                          <Badge
                            variant="outline"
                            className="ml-2 flex items-center gap-1 bg-purple-100 text-purple-800"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Redirect
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {network.security}
                        {network.signalStrength > 0 &&
                          ` • Signal: ${network.signalStrength}%`}
                        {network.settings?.priority &&
                          network.settings.priority > 0 &&
                          ` • Priority: ${network.settings.priority}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center mr-2">
                      <span className="text-xs mr-2">Auto-connect</span>
                      <Switch
                        checked={network.settings?.autoConnect ?? false}
                        onCheckedChange={() => toggleAutoConnect(network)}
                      />
                    </div>

                    {isConnected ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        disabled={isConnecting}
                      >
                        {isConnecting ? "Connecting..." : "Connected"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onConnect(network)}
                        disabled={
                          connectionStatus === ConnectionStatus.CONNECTING ||
                          connectionStatus === ConnectionStatus.AUTHENTICATING
                        }
                      >
                        Connect
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onForget(network)}>
                          Forget network
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleEditSettings(network)}
                        >
                          Edit settings
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleViewDetails(network)}
                        >
                          View details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </AnimatePresence>

      {showDetailsDialog && selectedNetwork && (
        <NetworkDetailsDialog
          network={selectedNetwork}
          onClose={() => setShowDetailsDialog(false)}
          animated={animated}
        />
      )}

      {showSettingsDialog && selectedNetwork && (
        <NetworkSettingsDialog
          network={selectedNetwork}
          onSave={handleSettingsUpdate}
          onCancel={() => setShowSettingsDialog(false)}
          animated={animated}
        />
      )}
    </div>
  );
}
