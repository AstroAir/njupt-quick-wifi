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
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import type { WiFiNetwork, NetworkSettings } from "@/types";

interface NetworkSettingsDialogProps {
  network: WiFiNetwork;
  onSave: (settings: Partial<NetworkSettings>) => void;
  onCancel: () => void;
  animated: boolean;
}

export function NetworkSettingsDialog({
  network,
  onSave,
  onCancel,
  animated,
}: NetworkSettingsDialogProps) {
  const [autoConnect, setAutoConnect] = useState(
    network.settings?.autoConnect ?? false
  );
  const [redirectUrl, setRedirectUrl] = useState(
    network.settings?.redirectUrl ?? ""
  );
  const [hidden, setHidden] = useState(network.settings?.hidden ?? false);
  const [priority, setPriority] = useState(network.settings?.priority ?? 0);
  const [redirectTimeout, setRedirectTimeout] = useState(
    network.settings?.redirectTimeout ?? 3000
  );
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate URL if provided
    if (redirectUrl && !isValidUrl(redirectUrl)) {
      setUrlError("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    onSave({
      autoConnect,
      redirectUrl: redirectUrl || null,
      hidden,
      priority,
      redirectTimeout,
    });
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Network Settings: {network.ssid}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <motion.div
            className="flex items-center justify-between"
            initial={animated ? { opacity: 0, y: 10 } : false}
            animate={animated ? { opacity: 1, y: 0 } : false}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Label htmlFor="auto-connect" className="flex-1">
              Auto Connect
            </Label>
            <Switch
              id="auto-connect"
              checked={autoConnect}
              onCheckedChange={setAutoConnect}
            />
          </motion.div>

          <motion.div
            className="flex items-center justify-between"
            initial={animated ? { opacity: 0, y: 10 } : false}
            animate={animated ? { opacity: 1, y: 0 } : false}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Label htmlFor="hidden-network" className="flex-1">
              Hidden Network
            </Label>
            <Switch
              id="hidden-network"
              checked={hidden}
              onCheckedChange={setHidden}
            />
          </motion.div>

          <motion.div
            className="space-y-2"
            initial={animated ? { opacity: 0, y: 10 } : false}
            animate={animated ? { opacity: 1, y: 0 } : false}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <div className="flex items-center justify-between">
              <Label htmlFor="priority" className="flex-1">
                Connection Priority: {priority}
              </Label>
            </div>
            <Slider
              id="priority"
              min={0}
              max={10}
              step={1}
              value={[priority]}
              onValueChange={(value) => setPriority(value[0])}
            />
            <p className="text-xs text-muted-foreground">
              Higher priority networks are preferred when multiple saved
              networks are available
            </p>
          </motion.div>

          <motion.div
            className="space-y-2"
            initial={animated ? { opacity: 0, y: 10 } : false}
            animate={animated ? { opacity: 1, y: 0 } : false}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Label htmlFor="redirect-url">Post-Connection Redirect URL</Label>
            <Input
              id="redirect-url"
              type="text"
              value={redirectUrl}
              onChange={(e) => {
                setRedirectUrl(e.target.value);
                setUrlError(null);
              }}
              placeholder="https://example.com"
              className={urlError ? "border-red-500" : ""}
            />
            {urlError && <p className="text-sm text-red-500">{urlError}</p>}
            <p className="text-xs text-muted-foreground">
              If set, this URL will automatically open after connecting to this
              network
            </p>
          </motion.div>

          <motion.div
            className="space-y-2"
            initial={animated ? { opacity: 0, y: 10 } : false}
            animate={animated ? { opacity: 1, y: 0 } : false}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <div className="flex items-center justify-between">
              <Label htmlFor="redirect-timeout" className="flex-1">
                Redirect Timeout: {redirectTimeout / 1000}s
              </Label>
            </div>
            <Slider
              id="redirect-timeout"
              min={1000}
              max={10000}
              step={1000}
              value={[redirectTimeout]}
              onValueChange={(value) => setRedirectTimeout(value[0])}
            />
            <p className="text-xs text-muted-foreground">
              Time to wait before opening the redirect URL after successful
              connection
            </p>
          </motion.div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Save Settings</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
