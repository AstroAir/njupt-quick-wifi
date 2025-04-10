"use client";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NetworkList } from "@/components/network-list";
import { SavedNetworks } from "@/components/saved-networks";
import { ConnectionStatus as ConnectionStatusComponent } from "@/components/connection-status";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  SettingsIcon,
  FilterIcon,
  AlertTriangle,
  WifiOff,
} from "lucide-react";
import { useWifiStore } from "@/store";
import { toast } from "sonner";
import { Settings } from "@/components/settings";
import { NetworkFilters } from "@/components/network-filters";
import { motion, AnimatePresence } from "framer-motion";
import type { WiFiNetwork } from "@/types";

// 定义扫描结果的接口
interface ScanResult {
  networks: WiFiNetwork[];
  timestamp: number;
}

export function WifiManager() {
  const [showFilters, setShowFilters] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [lastScanSuccess, setLastScanSuccess] = useState(true);

  const {
    savedNetworks,
    currentNetwork,
    connectionStatus,
    connectionError,
    isScanning,
    scanProgress,
    lastScanTime,
    isOffline,
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

  // 扫描网络的方法，包含错误处理
  const handleScan = useCallback(
    async (showToast = true) => {
      try {
        setLastScanSuccess(false);
        const result = await scanNetworks();
        setLastScanSuccess(true);
        setRetryCount(0);

        if (showToast && result?.networks?.length > 0) {
          toast.success(`找到 ${result.networks.length} 个WiFi网络`);
        }
        return result;
      } catch (error) {
        console.error("扫描网络出错:", error);
        setLastScanSuccess(false);
        const errorMessage =
          error instanceof Error ? error.message : "未知错误";
        setNetworkError(`扫描失败: ${errorMessage}`);

        if (showToast) {
          toast.error("网络扫描失败，请重试", {
            description: errorMessage,
            action: {
              label: "重试",
              onClick: () => {
                setRetryCount((prev) => prev + 1);
                handleScan();
              },
            },
          });
        }
        return null;
      }
    },
    [scanNetworks]
  );

  // 初始网络扫描和动画
  useEffect(() => {
    if (autoScanOnStartup) {
      const timer = setTimeout(() => {
        handleScan(false);
        setIsInitialLoad(false);
      }, 1000); // 延迟初始扫描以执行开场动画

      return () => clearTimeout(timer);
    } else {
      setIsInitialLoad(false);
    }
  }, [autoScanOnStartup, handleScan]);

  // 显示连接错误的toast提示
  useEffect(() => {
    if (connectionError) {
      toast.error("连接错误", {
        description: connectionError,
        action: {
          label: "重试",
          onClick: () => {
            if (currentNetwork) {
              connectToNetwork(currentNetwork);
            }
          },
        },
      });
    }
  }, [connectionError, currentNetwork, connectToNetwork]);

  // 处理离线状态
  useEffect(() => {
    if (isOffline) {
      toast.warning("网络连接已断开", {
        description: "WiFi服务暂时不可用，正在尝试恢复...",
        duration: 5000,
      });
    }
  }, [isOffline]);

  // 网络状态恢复检测
  useEffect(() => {
    if (isOffline) {
      const recoveryInterval = setInterval(() => {
        handleScan(false);
      }, 10000); // 每10秒检测一次网络恢复

      return () => clearInterval(recoveryInterval);
    }
  }, [isOffline, handleScan]);

  // 定时扫描网络
  useEffect(() => {
    const scanInterval = useWifiStore.getState().scanInterval;
    if (scanInterval > 0) {
      const intervalId = setInterval(() => {
        // 只在未扫描和未连接时扫描
        if (
          !isScanning &&
          connectionStatus !== "connecting" &&
          connectionStatus !== "authenticating" &&
          !isOffline
        ) {
          handleScan(false);
        }
      }, scanInterval);

      return () => clearInterval(intervalId);
    }
  }, [isScanning, connectionStatus, handleScan, isOffline]);

  const handleConnect = async (network: WiFiNetwork, password?: string) => {
    try {
      const success = await connectToNetwork(network, password);
      if (success) {
        toast.success(`成功连接到 ${network.ssid}`);
        return true;
      }
      toast.error(`无法连接到 ${network.ssid}`, {
        description: "请检查密码是否正确",
      });
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      toast.error(`连接错误: ${errorMessage}`);
      console.error("连接网络错误:", error);
      return false;
    }
  };

  const handleDisconnect = async () => {
    try {
      await Promise.resolve(disconnectFromNetwork());
      toast.info("您已从网络断开连接");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      toast.error(`断开连接错误: ${errorMessage}`);
      console.error("断开连接错误:", error);
    }
  };

  const handleForget = async (network: WiFiNetwork) => {
    try {
      await Promise.resolve(forgetNetwork(network));
      toast.success(`${network.ssid} 已从已保存网络中移除`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      toast.error(`移除网络错误: ${errorMessage}`);
      console.error("移除网络错误:", error);
    }
  };

  const formatLastScanTime = () => {
    if (!lastScanTime) return null;

    const seconds = Math.floor((Date.now() - lastScanTime) / 1000);
    if (seconds < 60) return `${seconds} 秒前`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
    return `${Math.floor(seconds / 3600)} 小时前`;
  };

  // 网络错误时的显示组件
  const NetworkErrorComponent = () => (
    <motion.div
      className="bg-red-50 border border-red-100 rounded-md p-4 my-2 flex items-start"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <AlertTriangle className="text-red-500 h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-red-800">网络错误</p>
        <p className="text-sm text-red-700">{networkError}</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 bg-red-100 hover:bg-red-200 border-red-200"
          onClick={() => {
            setRetryCount((prev) => prev + 1);
            handleScan(true);
          }}
        >
          重试扫描 ({retryCount})
        </Button>
      </div>
    </motion.div>
  );

  // 离线状态显示组件
  const OfflineStateComponent = () => (
    <motion.div
      className="bg-amber-50 border border-amber-100 rounded-md p-4 my-2 flex items-start"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <WifiOff className="text-amber-500 h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-amber-800">WiFi服务无法访问</p>
        <p className="text-sm text-amber-700">
          网络连接已断开，正在尝试恢复...
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 bg-amber-100 hover:bg-amber-200 border-amber-200"
          onClick={() => handleScan(true)}
        >
          检查连接
        </Button>
      </div>
    </motion.div>
  );

  return (
    <AnimatePresence>
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
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

        <AnimatePresence>
          {isOffline && <OfflineStateComponent />}
        </AnimatePresence>

        <AnimatePresence>
          {networkError && !isOffline && <NetworkErrorComponent />}
        </AnimatePresence>

        <Tabs defaultValue="available" className="w-full">
          <div className="px-4 pt-3 flex justify-between items-center">
            <TabsList className="flex-1 max-w-md">
              <TabsTrigger value="available" className="flex-1">
                可用网络
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex-1">
                已保存网络
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex-1">
                <SettingsIcon className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="available" className="p-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-medium">可用网络</h2>
                {lastScanTime && (
                  <p className="text-xs text-muted-foreground">
                    最近扫描: {formatLastScanTime()}
                    {!lastScanSuccess && (
                      <span className="text-red-500"> (扫描失败)</span>
                    )}
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
                  筛选
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleScan(true)}
                  disabled={isScanning || isOffline}
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      扫描中... {scanProgress}%
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      扫描
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
