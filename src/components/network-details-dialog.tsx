"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wifi, Lock, ExternalLink, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { SecurityType, type WiFiNetwork } from "@/types";

interface NetworkDetailsDialogProps {
  network: WiFiNetwork;
  onClose: () => void;
  animated: boolean;
}

export function NetworkDetailsDialog({
  network,
  onClose,
  animated,
}: NetworkDetailsDialogProps) {
  const getSecurityIcon = (security: string) => {
    switch (security) {
      case SecurityType.WPA3:
        return (
          <Shield className="h-4 w-4 absolute -right-1 -bottom-1 text-green-600" />
        );
      case SecurityType.WPA2_ENTERPRISE:
        return (
          <Shield className="h-4 w-4 absolute -right-1 -bottom-1 text-blue-600" />
        );
      case SecurityType.OPEN:
        return null;
      default:
        return <Lock className="h-4 w-4 absolute -right-1 -bottom-1" />;
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Network Details</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <motion.div
            className="flex items-center space-x-3 mb-4"
            initial={animated ? { opacity: 0, y: -10 } : false}
            animate={animated ? { opacity: 1, y: 0 } : false}
            transition={{ duration: 0.3 }}
          >
            <div className="relative">
              <Wifi className="h-6 w-6" />
              {getSecurityIcon(network.security)}
            </div>
            <div className="text-xl font-semibold">{network.ssid}</div>
          </motion.div>

          <div className="space-y-3">
            <motion.div
              className="grid grid-cols-2 gap-2"
              initial={animated ? { opacity: 0, y: 10 } : false}
              animate={animated ? { opacity: 1, y: 0 } : false}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <div className="text-sm font-medium">BSSID:</div>
              <div className="text-sm">{network.bssid}</div>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 gap-2"
              initial={animated ? { opacity: 0, y: 10 } : false}
              animate={animated ? { opacity: 1, y: 0 } : false}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              <div className="text-sm font-medium">Security:</div>
              <div className="text-sm">{network.security}</div>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 gap-2"
              initial={animated ? { opacity: 0, y: 10 } : false}
              animate={animated ? { opacity: 1, y: 0 } : false}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <div className="text-sm font-medium">Signal Strength:</div>
              <div className="text-sm">{network.signalStrength}%</div>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 gap-2"
              initial={animated ? { opacity: 0, y: 10 } : false}
              animate={animated ? { opacity: 1, y: 0 } : false}
              transition={{ duration: 0.3, delay: 0.25 }}
            >
              <div className="text-sm font-medium">Type:</div>
              <div className="text-sm">{network.type}</div>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 gap-2"
              initial={animated ? { opacity: 0, y: 10 } : false}
              animate={animated ? { opacity: 1, y: 0 } : false}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <div className="text-sm font-medium">Saved:</div>
              <div className="text-sm">{network.saved ? "Yes" : "No"}</div>
            </motion.div>

            {network.saved && (
              <>
                <motion.div
                  className="grid grid-cols-2 gap-2"
                  initial={animated ? { opacity: 0, y: 10 } : false}
                  animate={animated ? { opacity: 1, y: 0 } : false}
                  transition={{ duration: 0.3, delay: 0.35 }}
                >
                  <div className="text-sm font-medium">Auto Connect:</div>
                  <div className="text-sm">
                    {network.settings?.autoConnect ? "Yes" : "No"}
                  </div>
                </motion.div>

                <motion.div
                  className="grid grid-cols-2 gap-2"
                  initial={animated ? { opacity: 0, y: 10 } : false}
                  animate={animated ? { opacity: 1, y: 0 } : false}
                  transition={{ duration: 0.3, delay: 0.4 }}
                >
                  <div className="text-sm font-medium">Priority:</div>
                  <div className="text-sm">
                    {network.settings?.priority || 0}
                  </div>
                </motion.div>

                <motion.div
                  className="grid grid-cols-2 gap-2"
                  initial={animated ? { opacity: 0, y: 10 } : false}
                  animate={animated ? { opacity: 1, y: 0 } : false}
                  transition={{ duration: 0.3, delay: 0.45 }}
                >
                  <div className="text-sm font-medium">Hidden Network:</div>
                  <div className="text-sm">
                    {network.settings?.hidden ? "Yes" : "No"}
                  </div>
                </motion.div>

                <motion.div
                  className="grid grid-cols-2 gap-2"
                  initial={animated ? { opacity: 0, y: 10 } : false}
                  animate={animated ? { opacity: 1, y: 0 } : false}
                  transition={{ duration: 0.3, delay: 0.5 }}
                >
                  <div className="text-sm font-medium">Redirect URL:</div>
                  <div className="text-sm">
                    {network.settings?.redirectUrl ? (
                      <span className="flex items-center text-blue-600">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {network.settings.redirectUrl}
                      </span>
                    ) : (
                      "None"
                    )}
                  </div>
                </motion.div>

                <motion.div
                  className="grid grid-cols-2 gap-2"
                  initial={animated ? { opacity: 0, y: 10 } : false}
                  animate={animated ? { opacity: 1, y: 0 } : false}
                  transition={{ duration: 0.3, delay: 0.55 }}
                >
                  <div className="text-sm font-medium">Redirect Timeout:</div>
                  <div className="text-sm">
                    {network.settings?.redirectTimeout
                      ? `${network.settings.redirectTimeout / 1000} seconds`
                      : "Default"}
                  </div>
                </motion.div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
