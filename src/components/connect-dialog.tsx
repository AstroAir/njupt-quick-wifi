"use client";

import type React from "react";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Wifi, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { WiFiNetwork } from "@/types";

interface ConnectDialogProps {
  network: WiFiNetwork;
  onConnect: (password: string) => void;
  onCancel: () => void;
  animated: boolean;
}

export function ConnectDialog({
  network,
  onConnect,
  onCancel,
  animated,
}: ConnectDialogProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saveNetwork, setSaveNetwork] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic password validation
    if (network.security.includes("WPA2") && password.length < 8) {
      setError("Password must be at least 8 characters for WPA2 networks");
      return;
    }

    setIsConnecting(true);

    // Simulate connection delay
    setTimeout(() => {
      onConnect(password);
      setIsConnecting(false);
    }, 1000);
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Wifi className="mr-2 h-5 w-5" />
            Connect to {network.ssid}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <AnimatePresence>
            <motion.div
              className="flex items-center space-x-3 mb-4 p-3 bg-muted/40 rounded-md"
              initial={animated ? { opacity: 0, y: -10 } : false}
              animate={animated ? { opacity: 1, y: 0 } : false}
              transition={{ duration: 0.3 }}
            >
              <div className="relative">
                <Wifi className="h-5 w-5" />
                <Lock className="h-3 w-3 absolute -right-1 -bottom-1" />
              </div>
              <div>
                <div className="font-medium">{network.ssid}</div>
                <div className="text-xs text-muted-foreground">
                  {network.security} • Signal: {network.signalStrength}%
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <motion.div
            className="space-y-2"
            initial={animated ? { opacity: 0, y: 10 } : false}
            animate={animated ? { opacity: 1, y: 0 } : false}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter network password"
              required
              autoFocus
              className={error ? "border-red-500" : ""}
            />
            <AnimatePresence>
              {error && (
                <motion.p
                  className="text-sm text-red-500"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            className="flex items-center space-x-2"
            initial={animated ? { opacity: 0, y: 10 } : false}
            animate={animated ? { opacity: 1, y: 0 } : false}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Checkbox
              id="show-password"
              checked={showPassword}
              onCheckedChange={(checked) => setShowPassword(checked === true)}
            />
            <Label htmlFor="show-password" className="text-sm font-normal">
              Show password
            </Label>
          </motion.div>

          <motion.div
            className="flex items-center space-x-2"
            initial={animated ? { opacity: 0, y: 10 } : false}
            animate={animated ? { opacity: 1, y: 0 } : false}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Checkbox
              id="save-network"
              checked={saveNetwork}
              onCheckedChange={(checked) => setSaveNetwork(checked === true)}
            />
            <Label htmlFor="save-network" className="text-sm font-normal">
              Connect automatically
            </Label>
          </motion.div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!password || isConnecting}>
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
