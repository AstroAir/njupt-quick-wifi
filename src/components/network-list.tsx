"use client";

import { useState } from "react";
import { Lock, Wifi, WifiOff, MoreVertical, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConnectDialog } from "@/components/connect-dialog";
import { NetworkDetailsDialog } from "@/components/network-details-dialog";
import { Badge } from "@/components/ui/badge";
import { ConnectionStatus, SecurityType, type WiFiNetwork } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

interface NetworkListProps {
  networks: WiFiNetwork[];
  currentNetwork: WiFiNetwork | null;
  connectionStatus: ConnectionStatus;
  onConnect: (network: WiFiNetwork, password?: string) => void;
  onForget: (network: WiFiNetwork) => void;
  isScanning: boolean;
  animated: boolean;
  isInitialLoad: boolean;
}

export function NetworkList({
  networks,
  currentNetwork,
  connectionStatus,
  onConnect,
  onForget,
  isScanning,
  animated,
  isInitialLoad,
}: NetworkListProps) {
  const [selectedNetwork, setSelectedNetwork] = useState<WiFiNetwork | null>(
    null
  );
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const handleConnectClick = (network: WiFiNetwork) => {
    if (network.security === SecurityType.OPEN) {
      // For open networks, connect directly
      onConnect(network);
    } else {
      // For secured networks, show password dialog
      setSelectedNetwork(network);
      setShowConnectDialog(true);
    }
  };

  const handleConnectConfirm = (password: string) => {
    if (selectedNetwork) {
      onConnect(selectedNetwork, password);
      setShowConnectDialog(false);
    }
  };

  const handleViewDetails = (network: WiFiNetwork) => {
    setSelectedNetwork(network);
    setShowDetailsDialog(true);
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

  const getSignalStrengthClass = (strength: number) => {
    if (strength >= 80) return "text-green-600";
    if (strength >= 60) return "text-green-500";
    if (strength >= 40) return "text-yellow-500";
    if (strength >= 20) return "text-orange-500";
    return "text-red-500 opacity-70";
  };

  const getConnectionBadge = (network: WiFiNetwork) => {
    const isConnected = currentNetwork?.bssid === network.bssid;

    if (isConnected) {
      if (connectionStatus === ConnectionStatus.CONNECTING) {
        return (
          <Badge
            variant="outline"
            className="ml-2 bg-yellow-100 text-yellow-800"
          >
            Connecting...
          </Badge>
        );
      } else if (connectionStatus === ConnectionStatus.AUTHENTICATING) {
        return (
          <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800">
            Authenticating...
          </Badge>
        );
      } else if (connectionStatus === ConnectionStatus.CONNECTED) {
        return (
          <Badge className="ml-2 bg-green-100 text-green-800">Connected</Badge>
        );
      } else if (connectionStatus === ConnectionStatus.ERROR) {
        return (
          <Badge variant="destructive" className="ml-2">
            Error
          </Badge>
        );
      }
    }

    return network.saved ? (
      <Badge variant="outline" className="ml-2">
        Saved
      </Badge>
    ) : null;
  };

  // Loading skeletons for initial load
  if (isInitialLoad) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-md"
          >
            <div className="flex items-center space-x-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24 mt-1" />
              </div>
            </div>
            <Skeleton className="h-9 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
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
            <p>No networks found</p>
            <p className="text-sm">
              Try scanning again or adjusting your filters
            </p>
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
                    delay: isScanning ? 0 : index * 0.05,
                    ease: "easeOut",
                  }}
                  layout
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Wifi
                        className={`h-5 w-5 ${getSignalStrengthClass(
                          network.signalStrength
                        )}`}
                      />
                      {getSecurityIcon(network.security)}
                    </div>

                    <div>
                      <div className="font-medium flex items-center">
                        {network.ssid}
                        {getConnectionBadge(network)}
                        {network.settings?.redirectUrl && (
                          <Badge
                            variant="outline"
                            className="ml-2 bg-purple-100 text-purple-800"
                          >
                            Redirect
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center">
                        {network.security} • Signal: {network.signalStrength}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {isConnected ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => onForget(network)}
                        disabled={isConnecting}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnectClick(network)}
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
                        {network.saved ? (
                          <DropdownMenuItem onClick={() => onForget(network)}>
                            Forget network
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleConnectClick(network)}
                          >
                            Connect
                          </DropdownMenuItem>
                        )}
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

      {showConnectDialog && selectedNetwork && (
        <ConnectDialog
          network={selectedNetwork}
          onConnect={handleConnectConfirm}
          onCancel={() => setShowConnectDialog(false)}
          animated={animated}
        />
      )}

      {showDetailsDialog && selectedNetwork && (
        <NetworkDetailsDialog
          network={selectedNetwork}
          onClose={() => setShowDetailsDialog(false)}
          animated={animated}
        />
      )}
    </div>
  );
}
