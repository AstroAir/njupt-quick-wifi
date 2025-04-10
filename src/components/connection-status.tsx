"use client";

import { Wifi, WifiOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ConnectionStatus as ConnectionStatusEnum,
  type WiFiNetwork,
} from "@/types";
import { motion, AnimatePresence } from "framer-motion";

interface ConnectionStatusProps {
  currentNetwork: WiFiNetwork | null;
  status: ConnectionStatusEnum;
  onDisconnect: () => void;
  animated: boolean;
}

export function ConnectionStatus({
  currentNetwork,
  status,
  onDisconnect,
  animated,
}: ConnectionStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case ConnectionStatusEnum.CONNECTED:
        return "bg-green-100 text-green-600";
      case ConnectionStatusEnum.CONNECTING:
      case ConnectionStatusEnum.AUTHENTICATING:
        return "bg-yellow-100 text-yellow-600";
      case ConnectionStatusEnum.ERROR:
        return "bg-red-100 text-red-600";
      default:
        return "bg-gray-100 text-gray-500";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case ConnectionStatusEnum.CONNECTED:
        return "Connected";
      case ConnectionStatusEnum.CONNECTING:
        return "Connecting...";
      case ConnectionStatusEnum.AUTHENTICATING:
        return "Authenticating...";
      case ConnectionStatusEnum.ERROR:
        return "Connection Error";
      default:
        return "Not connected";
    }
  };

  const getProgressValue = () => {
    switch (status) {
      case ConnectionStatusEnum.CONNECTING:
        return 50;
      case ConnectionStatusEnum.AUTHENTICATING:
        return 75;
      case ConnectionStatusEnum.CONNECTED:
        return 100;
      default:
        return 0;
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <AnimatePresence mode="wait">
          {currentNetwork ? (
            <motion.div
              key="connected"
              className="flex items-center"
              initial={animated ? { opacity: 0, x: -20 } : undefined}
              animate={animated ? { opacity: 1, x: 0 } : undefined}
              exit={animated ? { opacity: 0, x: -20 } : undefined}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className={`p-2 rounded-full mr-3 ${getStatusColor()}`}
                animate={
                  status === ConnectionStatusEnum.CONNECTING ||
                  status === ConnectionStatusEnum.AUTHENTICATING
                    ? { scale: [1, 1.1, 1], opacity: [1, 0.8, 1] }
                    : {}
                }
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5 }}
              >
                <Wifi className="h-5 w-5" />
              </motion.div>
              <div>
                <div className="font-medium flex items-center">
                  {getStatusText()}{" "}
                  {currentNetwork.ssid && `to ${currentNetwork.ssid}`}
                  {(status === ConnectionStatusEnum.CONNECTING ||
                    status === ConnectionStatusEnum.AUTHENTICATING) && (
                    <motion.div className="w-20 ml-2">
                      <Progress value={getProgressValue()} className="h-2" />
                    </motion.div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {currentNetwork.signalStrength > 0 &&
                    `Signal strength: ${currentNetwork.signalStrength}% • `}
                  {currentNetwork.security}
                  {currentNetwork.settings?.redirectUrl && (
                    <motion.span
                      className="ml-2 flex items-center text-purple-600"
                      initial={animated ? { opacity: 0 } : false}
                      animate={animated ? { opacity: 1 } : false}
                      transition={{ delay: 0.3 }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Secondary login configured
                    </motion.span>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="disconnected"
              className="flex items-center"
              initial={animated ? { opacity: 0, x: -20 } : undefined}
              animate={animated ? { opacity: 1, x: 0 } : undefined}
              exit={animated ? { opacity: 0, x: -20 } : undefined}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-gray-100 p-2 rounded-full mr-3">
                <WifiOff className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <div className="font-medium">Not connected</div>
                <div className="text-sm text-muted-foreground">
                  Select a network to connect
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {currentNetwork && (
        <motion.div
          initial={animated ? { opacity: 0, scale: 0.9 } : undefined}
          animate={animated ? { opacity: 1, scale: 1 } : undefined}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Button variant="outline" size="sm" onClick={onDisconnect}>
            Disconnect
          </Button>
        </motion.div>
      )}
    </div>
  );
}
