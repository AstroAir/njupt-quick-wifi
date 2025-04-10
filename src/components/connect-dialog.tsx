"use client";

import type React from "react";

import { useState, useEffect } from "react";
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
import { Loader2, Wifi, Lock, AlertCircle, ShieldAlert, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { WiFiNetwork } from "@/types";
import { SecurityType } from "@/types";

interface ConnectDialogProps {
  network: WiFiNetwork;
  onConnect: (password: string, saveNetwork: boolean) => Promise<boolean> | boolean;
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
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // 重置表单错误，当密码变化时
  useEffect(() => {
    if (error) setError(null);
  }, [error, password]);

  // 获取特定网络安全类型的密码要求
  const getPasswordRequirements = () => {
    switch (network.security) {
      case SecurityType.WPA3:
        return { minLength: 8, message: "密码必须至少为8个字符（WPA3安全标准）" };
      case SecurityType.WPA2:
      case SecurityType.WPA2_ENTERPRISE:
        return { minLength: 8, message: "密码必须至少为8个字符（WPA2安全标准）" };
      case SecurityType.WPA:
        return { minLength: 8, message: "密码必须至少为8个字符（WPA安全标准）" };
      case SecurityType.WEP:
        return { minLength: 5, message: "WEP密钥必须为5或13个字符，或10或26个十六进制字符" };
      case SecurityType.OPEN:
        return { minLength: 0, message: "" };
      default:
        return { minLength: 8, message: "密码必须至少为8个字符" };
    }
  };

  const validatePassword = () => {
    // 开放网络不需要密码
    if (network.security === SecurityType.OPEN) return true;

    const requirements = getPasswordRequirements();
    
    if (password.length < requirements.minLength) {
      setError(requirements.message);
      return false;
    }

    // WEP特定验证
    if (network.security === SecurityType.WEP) {
      // WEP要求密钥长度为5或13个ASCII字符，或10或26个十六进制字符
      const isValidLength = [5, 13].includes(password.length) || 
                           ([10, 26].includes(password.length) && /^[0-9A-Fa-f]+$/.test(password));
      
      if (!isValidLength) {
        setError("无效的WEP密钥。必须为5或13个ASCII字符，或10或26个十六进制字符");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 密码验证
    if (!validatePassword()) return;

    setIsConnecting(true);
    setConnectionAttempts(prev => prev + 1);

    try {
      const result = await Promise.resolve(onConnect(password, saveNetwork));
      
      if (!result) {
        // 连接失败
        setError("连接失败，请检查密码或网络设置");
        setIsConnecting(false);
      }
      // 成功情况下，对话框会被关闭，由onConnect处理
    } catch (err) {
      console.error("连接错误:", err);
      setError(`连接错误: ${err instanceof Error ? err.message : "未知错误"}`);
      setIsConnecting(false);
    }
  };

  // 提供有用的信息提示
  const getSecurityInfo = () => {
    switch (network.security) {
      case SecurityType.WPA3:
        return "WPA3提供最高级别的安全保护";
      case SecurityType.WPA2_ENTERPRISE:
        return "企业级WPA2需要身份验证凭据";
      case SecurityType.WPA2:
        return "WPA2是目前常用的安全标准";
      case SecurityType.OPEN:
        return "警告：这是一个开放网络，没有加密保护";
      default:
        return null;
    }
  };

  const securityInfo = getSecurityInfo();

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Wifi className="mr-2 h-5 w-5" />
            连接到 {network.ssid}
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
                {network.security !== SecurityType.OPEN && (
                  <Lock className="h-3 w-3 absolute -right-1 -bottom-1" />
                )}
              </div>
              <div>
                <div className="font-medium">{network.ssid}</div>
                <div className="text-xs text-muted-foreground">
                  {network.security} • 信号强度: {network.signalStrength}%
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {securityInfo && (
            <motion.div
              className="flex items-center p-3 rounded-md bg-blue-50 text-blue-700 text-sm"
              initial={animated ? { opacity: 0, scale: 0.95 } : false}
              animate={animated ? { opacity: 1, scale: 1 } : false}
              transition={{ duration: 0.3 }}
            >
              <Info className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>{securityInfo}</span>
            </motion.div>
          )}

          {network.security !== SecurityType.OPEN && (
            <motion.div
              className="space-y-2"
              initial={animated ? { opacity: 0, y: 10 } : false}
              animate={animated ? { opacity: 1, y: 0 } : false}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入网络密码"
                required
                autoFocus
                className={error ? "border-red-500" : ""}
                aria-invalid={!!error}
              />
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="text-sm text-red-500 flex items-center"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {network.security !== SecurityType.OPEN && (
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
                显示密码
              </Label>
            </motion.div>
          )}

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
              自动连接
            </Label>
          </motion.div>

          {network.security === SecurityType.OPEN && (
            <motion.div
              className="bg-yellow-50 border border-yellow-100 p-3 rounded-md flex items-start space-x-2 text-sm"
              initial={animated ? { opacity: 0, y: 10 } : false}
              animate={animated ? { opacity: 1, y: 0 } : false}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <ShieldAlert className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">安全警告：</span>这是一个开放网络，您的数据可能不会被加密。只有在信任此网络的情况下继续连接。
              </div>
            </motion.div>
          )}

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              disabled={isConnecting}
            >
              取消
            </Button>
            <Button 
              type="submit" 
              disabled={(network.security !== SecurityType.OPEN && !password) || isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  连接中...
                </>
              ) : (
                "连接"
              )}
            </Button>
          </DialogFooter>

          {connectionAttempts > 1 && (
            <motion.div
              className="text-xs text-center text-muted-foreground pt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              连接尝试: {connectionAttempts}
            </motion.div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
