"use client";

import { useState, useEffect } from "react";
import {
  Lock,
  Wifi,
  WifiOff,
  MoreVertical,
  Shield,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
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
  onConnect: (
    network: WiFiNetwork,
    password?: string
  ) => Promise<boolean> | boolean;
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
  const [connectingNetwork, setConnectingNetwork] = useState<string | null>(
    null
  );
  const [connectError, setConnectError] = useState<{
    networkId: string;
    message: string;
  } | null>(null);
  const [retryAttempts, setRetryAttempts] = useState<Record<string, number>>(
    {}
  );

  // 重置特定网络的错误状态
  useEffect(() => {
    if (connectionStatus === ConnectionStatus.CONNECTED && connectError) {
      setConnectError(null);
    }
  }, [connectionStatus, connectError]);

  const handleConnectClick = (network: WiFiNetwork) => {
    setConnectError(null);

    if (network.security === SecurityType.OPEN) {
      // 对于开放网络，直接连接
      handleConnectToNetwork(network);
    } else {
      // 对于需要密码的网络，显示密码对话框
      setSelectedNetwork(network);
      setShowConnectDialog(true);
    }
  };

  const handleConnectToNetwork = async (
    network: WiFiNetwork,
    password?: string
  ) => {
    try {
      setConnectingNetwork(network.bssid);
      setConnectError(null);

      // 更新重试计数
      setRetryAttempts((prev) => ({
        ...prev,
        [network.bssid]: (prev[network.bssid] || 0) + 1,
      }));

      const success = await Promise.resolve(onConnect(network, password));

      if (!success) {
        setConnectError({
          networkId: network.bssid,
          message: "连接失败，请检查密码或网络可用性",
        });
      }

      return success;
    } catch (err) {
      console.error("连接错误:", err);
      setConnectError({
        networkId: network.bssid,
        message: err instanceof Error ? err.message : "未知错误",
      });
      return false;
    } finally {
      setConnectingNetwork(null);
    }
  };

  const handleConnectConfirm = async (password: string) => {
    if (!selectedNetwork) return false;

    const success = await handleConnectToNetwork(selectedNetwork, password);

    if (success) {
      // 成功情况下关闭对话框
      setShowConnectDialog(false);
    }

    return success;
  };

  const handleRetryConnection = async (network: WiFiNetwork) => {
    setConnectError(null);
    handleConnectClick(network);
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
    const isConnecting =
      connectingNetwork === network.bssid ||
      (isConnected &&
        (connectionStatus === ConnectionStatus.CONNECTING ||
          connectionStatus === ConnectionStatus.AUTHENTICATING));

    if (isConnected) {
      if (connectionStatus === ConnectionStatus.CONNECTING) {
        return (
          <Badge
            variant="outline"
            className="ml-2 bg-yellow-100 text-yellow-800"
          >
            连接中...
          </Badge>
        );
      } else if (connectionStatus === ConnectionStatus.AUTHENTICATING) {
        return (
          <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800">
            认证中...
          </Badge>
        );
      } else if (connectionStatus === ConnectionStatus.CONNECTED) {
        return (
          <Badge className="ml-2 bg-green-100 text-green-800">已连接</Badge>
        );
      } else if (connectionStatus === ConnectionStatus.ERROR) {
        return (
          <Badge variant="destructive" className="ml-2">
            错误
          </Badge>
        );
      }
    } else if (isConnecting) {
      return (
        <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800">
          连接中...
        </Badge>
      );
    }

    return network.saved ? (
      <Badge variant="outline" className="ml-2">
        已保存
      </Badge>
    ) : null;
  };

  // 加载骨架屏
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
            <p>未找到网络</p>
            <p className="text-sm">尝试再次扫描或调整过滤条件</p>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {networks.map((network, index) => {
              const isConnected = currentNetwork?.bssid === network.bssid;
              const isConnecting =
                connectingNetwork === network.bssid ||
                (isConnected &&
                  (connectionStatus === ConnectionStatus.CONNECTING ||
                    connectionStatus === ConnectionStatus.AUTHENTICATING));
              const hasError = connectError?.networkId === network.bssid;
              const retryCount = retryAttempts[network.bssid] || 0;

              return (
                <motion.div
                  key={network.bssid}
                  className={`flex flex-col rounded-md ${
                    isConnected
                      ? "bg-primary/10"
                      : hasError
                      ? "bg-red-50"
                      : "hover:bg-muted"
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
                  <div className="flex items-center justify-between p-3">
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
                              重定向
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center">
                          {network.security} • 信号强度:{" "}
                          {network.signalStrength}%
                          {retryCount > 1 && (
                            <span className="ml-2 text-amber-600">
                              • 尝试次数: {retryCount}
                            </span>
                          )}
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
                          断开
                        </Button>
                      ) : (
                        <Button
                          variant={hasError ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => handleConnectClick(network)}
                          disabled={isConnecting}
                        >
                          {isConnecting ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          ) : hasError ? (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          ) : null}
                          {isConnecting ? "连接中..." : "连接"}
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {network.saved ? (
                            <DropdownMenuItem onClick={() => onForget(network)}>
                              移除网络
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleConnectClick(network)}
                            >
                              连接
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleViewDetails(network)}
                          >
                            查看详情
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {hasError && (
                    <motion.div
                      className="px-3 pb-3 -mt-1 flex items-start"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="bg-red-50 border border-red-100 rounded p-2 flex items-center text-sm text-red-700 w-full">
                        <AlertTriangle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
                        <span className="flex-1">
                          {connectError?.message || "连接失败，请检查网络设置"}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2 bg-white"
                          onClick={() => handleRetryConnection(network)}
                        >
                          重试
                        </Button>
                      </div>
                    </motion.div>
                  )}
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
