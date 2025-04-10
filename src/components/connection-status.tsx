"use client";

import { useState } from "react";
import { Wifi, WifiOff, ExternalLink, AlertTriangle, RotateCw, XCircle } from "lucide-react";
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
  connectionError?: string | null;
  onRetry?: () => void;
}

export function ConnectionStatus({
  currentNetwork,
  status,
  onDisconnect,
  animated,
  connectionError,
  onRetry,
}: ConnectionStatusProps) {
  const [showErrorDetails, setShowErrorDetails] = useState(false);

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
        return "已连接";
      case ConnectionStatusEnum.CONNECTING:
        return "连接中...";
      case ConnectionStatusEnum.AUTHENTICATING:
        return "认证中...";
      case ConnectionStatusEnum.ERROR:
        return "连接错误";
      default:
        return "未连接";
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

  // 根据错误提供解决建议
  const getSuggestion = () => {
    if (!connectionError) return null;
    
    if (connectionError.toLowerCase().includes("password")) {
      return "请检查网络密码是否正确";
    } else if (connectionError.toLowerCase().includes("timeout")) {
      return "网络响应超时，请确认网络是否可用";
    } else if (connectionError.toLowerCase().includes("auth") || connectionError.toLowerCase().includes("认证")) {
      return "身份验证失败，请检查密码或登录凭据";
    } else if (connectionError.toLowerCase().includes("ssid") || connectionError.toLowerCase().includes("不存在")) {
      return "网络可能已不可用或超出范围";
    }
    
    return "尝试重新连接或选择其他网络";
  };

  return (
    <div className="relative">
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
                  {status === ConnectionStatusEnum.ERROR ? (
                    <XCircle className="h-5 w-5" />
                  ) : (
                    <Wifi className="h-5 w-5" />
                  )}
                </motion.div>
                <div>
                  <div className="font-medium flex items-center">
                    {getStatusText()}{" "}
                    {currentNetwork.ssid && `到 ${currentNetwork.ssid}`}
                    {(status === ConnectionStatusEnum.CONNECTING ||
                      status === ConnectionStatusEnum.AUTHENTICATING) && (
                      <motion.div className="w-20 ml-2">
                        <Progress value={getProgressValue()} className="h-2" />
                      </motion.div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {currentNetwork.signalStrength > 0 &&
                      `信号强度: ${currentNetwork.signalStrength}% • `}
                    {currentNetwork.security}
                    {currentNetwork.settings?.redirectUrl && (
                      <motion.span
                        className="ml-2 flex items-center text-purple-600"
                        initial={animated ? { opacity: 0 } : false}
                        animate={animated ? { opacity: 1 } : false}
                        transition={{ delay: 0.3 }}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        已配置二级登录
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
                  <div className="font-medium">未连接</div>
                  <div className="text-sm text-muted-foreground">
                    选择网络进行连接
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
            <div className="flex items-center space-x-2">
              {status === ConnectionStatusEnum.ERROR && onRetry && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onRetry}
                  className="bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                >
                  <RotateCw className="h-4 w-4 mr-1" />
                  重试
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onDisconnect}>
                断开
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {status === ConnectionStatusEnum.ERROR && connectionError && (
          <motion.div
            className="mt-2 bg-red-50 border border-red-100 rounded-md p-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-start">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0 mr-2" />
              <div className="space-y-1 flex-1">
                <p className="text-sm text-red-800">
                  连接到 {currentNetwork?.ssid} 时出错
                </p>
                
                {showErrorDetails ? (
                  <>
                    <p className="text-xs text-red-700 break-words whitespace-normal">
                      {connectionError}
                    </p>
                    <p className="text-xs font-medium text-red-800">
                      建议: {getSuggestion()}
                    </p>
                    <Button 
                      variant="link" 
                      className="text-xs p-0 h-auto text-red-600" 
                      onClick={() => setShowErrorDetails(false)}
                    >
                      隐藏详情
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="link" 
                    className="text-xs p-0 h-auto text-red-600" 
                    onClick={() => setShowErrorDetails(true)}
                  >
                    查看详情
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
