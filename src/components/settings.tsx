"use client";

import { useWifiStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export function Settings() {
  const {
    defaultRedirectUrl,
    autoScanOnStartup,
    autoReconnect,
    secureStorage,
    defaultRedirectTimeout,
    scanInterval,
    animationsEnabled,
    darkMode,
    updateSettings,
    scanNetworks,
  } = useWifiStore();

  const [redirectUrl, setRedirectUrl] = useState(defaultRedirectUrl || "");
  const [redirectTimeout, setRedirectTimeout] = useState(
    defaultRedirectTimeout
  );
  const [scanIntervalValue, setScanIntervalValue] = useState(
    scanInterval / 1000
  ); // Convert to seconds for UI
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleSaveSettings = () => {
    // Validate URL if provided
    if (redirectUrl && !isValidUrl(redirectUrl)) {
      setUrlError("Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    updateSettings({
      defaultRedirectUrl: redirectUrl || null,
      autoScanOnStartup,
      autoReconnect,
      secureStorage,
      defaultRedirectTimeout: redirectTimeout,
      scanInterval: scanIntervalValue * 1000, // Convert back to milliseconds
      animationsEnabled,
      darkMode,
    });

    toast("Settings Saved", {
      description: "Your WiFi settings have been updated",
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

  const handleReset = () => {
    if (
      confirm(
        "Are you sure you want to reset all WiFi settings? This will remove all saved networks."
      )
    ) {
      // In a real app, we would clear local storage or call an API
      updateSettings({
        defaultRedirectUrl: null,
        autoScanOnStartup: true,
        autoReconnect: true,
        secureStorage: true,
        defaultRedirectTimeout: 3000,
        scanInterval: 30000,
        animationsEnabled: true,
        darkMode: null,
      });

      toast("Settings Reset", {
        description: "All WiFi settings have been reset to defaults",
      });

      // Trigger a new scan
      scanNetworks();
    }
  };

  return (
    <div className="space-y-6">
      <motion.h2
        className="text-lg font-medium"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        WiFi Settings
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Connection Settings</CardTitle>
            <CardDescription>
              Configure how the WiFi manager connects to networks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-scan" className="flex-1">
                Auto-scan on startup
              </Label>
              <Switch
                id="auto-scan"
                checked={autoScanOnStartup}
                onCheckedChange={(checked) =>
                  updateSettings({ autoScanOnStartup: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="auto-reconnect" className="flex-1">
                Auto-reconnect to known networks
              </Label>
              <Switch
                id="auto-reconnect"
                checked={autoReconnect}
                onCheckedChange={(checked) =>
                  updateSettings({ autoReconnect: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="scan-interval" className="flex-1">
                  Auto-scan interval: {scanIntervalValue} seconds
                </Label>
              </div>
              <Slider
                id="scan-interval"
                min={0}
                max={120}
                step={10}
                value={[scanIntervalValue]}
                onValueChange={(value) => setScanIntervalValue(value[0])}
              />
              <p className="text-xs text-muted-foreground">
                Set to 0 to disable automatic scanning
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Redirect Settings</CardTitle>
            <CardDescription>
              Configure automatic redirects after connection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default-redirect">
                Default Post-Connection Redirect URL
              </Label>
              <Input
                id="default-redirect"
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
                If set, this URL will automatically open after connecting to any
                network that doesn&apos;t have its own redirect URL
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="redirect-timeout" className="flex-1">
                  Default redirect timeout: {redirectTimeout / 1000} seconds
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
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
            <CardDescription>
              Configure security options for WiFi connections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="secure-storage" className="flex-1">
                  Secure credential storage
                </Label>
                <p className="text-xs text-muted-foreground">
                  Store network passwords securely
                </p>
              </div>
              <Switch
                id="secure-storage"
                checked={secureStorage}
                onCheckedChange={(checked) =>
                  updateSettings({ secureStorage: checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Interface Settings</CardTitle>
            <CardDescription>
              Configure the appearance and behavior of the interface
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="animations" className="flex-1">
                  Enable animations
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show smooth transitions and animations
                </p>
              </div>
              <Switch
                id="animations"
                checked={animationsEnabled}
                onCheckedChange={(checked) =>
                  updateSettings({ animationsEnabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="dark-mode" className="flex-1">
                  Dark mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  Use dark color scheme
                </p>
              </div>
              <Switch
                id="dark-mode"
                checked={darkMode === true}
                onCheckedChange={(checked) =>
                  updateSettings({ darkMode: checked ? true : null })
                }
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleReset}>
          Reset All Settings
        </Button>
        <Button onClick={handleSaveSettings}>Save Settings</Button>
      </div>
    </div>
  );
}
