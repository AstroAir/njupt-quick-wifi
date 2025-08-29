"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Zap, 
  Signal,
  Clock,
  CheckCircle,
  AlertTriangle,
  Settings
} from "lucide-react"
import { useWifiStore } from "@/store"
import { ConnectionStatus, WiFiNetwork } from "@/types"
import { logger } from "@/lib/logger"
import { toast } from "sonner"

interface ConnectionAttempt {
  network: WiFiNetwork
  startTime: number
  endTime?: number
  success: boolean
  error?: string
  retryCount: number
}

interface SmartConnectionOptions {
  enableAutoRetry: boolean
  maxRetries: number
  retryDelay: number
  prioritizeSignalStrength: boolean
  prioritizeSavedNetworks: boolean
  enableFallback: boolean
  timeoutDuration: number
}

export function SmartConnectionManager() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionProgress, setConnectionProgress] = useState(0)
  const [currentAttempt, setCurrentAttempt] = useState<ConnectionAttempt | null>(null)
  const [connectionHistory, setConnectionHistory] = useState<ConnectionAttempt[]>([])
  const [smartOptions, setSmartOptions] = useState<SmartConnectionOptions>({
    enableAutoRetry: true,
    maxRetries: 3,
    retryDelay: 2000,
    prioritizeSignalStrength: true,
    prioritizeSavedNetworks: true,
    enableFallback: true,
    timeoutDuration: 30000
  })
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)

  const {
    availableNetworks,
    savedNetworks,
    currentNetwork,
    connectionStatus,
    connectToNetwork,
    disconnectFromNetwork,
    autoReconnect
  } = useWifiStore()

  // Smart network selection algorithm
  const selectBestNetwork = useCallback((): WiFiNetwork | null => {
    let candidates = availableNetworks.filter(network => 
      network.signalStrength > 20 // Minimum signal threshold
    )

    if (candidates.length === 0) return null

    // Prioritize saved networks if enabled
    if (smartOptions.prioritizeSavedNetworks) {
      const savedCandidates = candidates.filter(network => network.saved)
      if (savedCandidates.length > 0) {
        candidates = savedCandidates
      }
    }

    // Sort by multiple criteria
    candidates.sort((a, b) => {
      // Priority 1: Saved networks (if enabled)
      if (smartOptions.prioritizeSavedNetworks) {
        if (a.saved && !b.saved) return -1
        if (!a.saved && b.saved) return 1
      }

      // Priority 2: Signal strength (if enabled)
      if (smartOptions.prioritizeSignalStrength) {
        const signalDiff = b.signalStrength - a.signalStrength
        if (Math.abs(signalDiff) > 10) return signalDiff
      }

      // Priority 3: Security (prefer secured networks)
      const aSecure = a.security !== 'Open'
      const bSecure = b.security !== 'Open'
      if (aSecure && !bSecure) return -1
      if (!aSecure && bSecure) return 1

      // Priority 4: Network priority setting
      const aPriority = a.settings?.priority || 0
      const bPriority = b.settings?.priority || 0
      return bPriority - aPriority
    })

    return candidates[0]
  }, [availableNetworks, smartOptions])

  // Select fallback network
  const selectFallbackNetwork = useCallback((failedNetwork: WiFiNetwork): WiFiNetwork | null => {
    const alternatives = availableNetworks.filter(network =>
      network.bssid !== failedNetwork.bssid &&
      network.signalStrength > 15 &&
      network.saved // Only try saved networks as fallback
    )

    return alternatives.sort((a, b) => b.signalStrength - a.signalStrength)[0] || null
  }, [availableNetworks])

  // Enhanced connection function with retry logic
  const smartConnect = useCallback(async (
    targetNetwork?: WiFiNetwork,
    password?: string
  ): Promise<boolean> => {
    const network = targetNetwork || selectBestNetwork()
    if (!network) {
      toast.error('没有找到可连接的网络')
      return false
    }

    setIsConnecting(true)
    setConnectionProgress(0)

    const attempt: ConnectionAttempt = {
      network,
      startTime: Date.now(),
      success: false,
      retryCount: 0
    }
    setCurrentAttempt(attempt)

    let retryCount = 0
    const maxRetries = smartOptions.enableAutoRetry ? smartOptions.maxRetries : 1

    while (retryCount < maxRetries) {
      try {
        logger.info(`Attempting to connect to ${network.ssid} (attempt ${retryCount + 1}/${maxRetries})`)
        
        // Update progress
        setConnectionProgress((retryCount / maxRetries) * 50)
        
        // Show connection status
        toast.info(`正在连接到 ${network.ssid}...`, {
          duration: smartOptions.timeoutDuration
        })

        // Attempt connection
        const success = await connectToNetwork(network, password || '')
        
        if (success) {
          attempt.success = true
          attempt.endTime = Date.now()
          setConnectionProgress(100)
          
          // Add to history
          setConnectionHistory(prev => [attempt, ...prev.slice(0, 9)]) // Keep last 10
          
          toast.success(`成功连接到 ${network.ssid}`)
          logger.info(`Successfully connected to ${network.ssid}`)
          
          setIsConnecting(false)
          setCurrentAttempt(null)
          return true
        }
        
        throw new Error('Connection failed')
        
      } catch (error) {
        retryCount++
        attempt.retryCount = retryCount
        
        const errorMessage = error instanceof Error ? error.message : '连接失败'
        logger.warn(`Connection attempt ${retryCount} failed: ${errorMessage}`)
        
        if (retryCount < maxRetries) {
          toast.info(`连接失败，${smartOptions.retryDelay / 1000}秒后重试...`)
          setConnectionProgress((retryCount / maxRetries) * 50 + 25)
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, smartOptions.retryDelay))
        } else {
          // All retries exhausted
          attempt.success = false
          attempt.error = errorMessage
          attempt.endTime = Date.now()
          
          setConnectionHistory(prev => [attempt, ...prev.slice(0, 9)])
          
          // Try fallback if enabled
          if (smartOptions.enableFallback && !targetNetwork) {
            const fallbackNetwork = selectFallbackNetwork(network)
            if (fallbackNetwork) {
              toast.info(`尝试连接备用网络 ${fallbackNetwork.ssid}...`)
              const fallbackSuccess = await smartConnect(fallbackNetwork)
              if (fallbackSuccess) {
                setIsConnecting(false)
                setCurrentAttempt(null)
                return true
              }
            }
          }
          
          toast.error(`无法连接到 ${network.ssid}`)
          logger.error(`Failed to connect to ${network.ssid} after ${maxRetries} attempts`)
        }
      }
    }

    setIsConnecting(false)
    setCurrentAttempt(null)
    setConnectionProgress(0)
    return false
  }, [connectToNetwork, selectBestNetwork, smartOptions, selectFallbackNetwork])



  // Auto-reconnect logic
  useEffect(() => {
    if (autoReconnect && 
        connectionStatus === ConnectionStatus.DISCONNECTED && 
        !isConnecting &&
        savedNetworks.length > 0) {
      
      const timer = setTimeout(() => {
        logger.info('Auto-reconnect triggered')
        smartConnect()
      }, 5000) // Wait 5 seconds before auto-reconnect

      return () => clearTimeout(timer)
    }
  }, [connectionStatus, autoReconnect, isConnecting, savedNetworks.length, smartConnect])

  // Connection quality monitoring
  const getConnectionQuality = (): 'excellent' | 'good' | 'fair' | 'poor' | null => {
    if (!currentNetwork || connectionStatus !== ConnectionStatus.CONNECTED) return null
    
    const signal = currentNetwork.signalStrength
    if (signal >= 80) return 'excellent'
    if (signal >= 60) return 'good'
    if (signal >= 40) return 'fair'
    return 'poor'
  }

  const getQualityColor = (quality: string | null) => {
    switch (quality) {
      case 'excellent': return 'text-green-600 bg-green-100'
      case 'good': return 'text-blue-600 bg-blue-100'
      case 'fair': return 'text-yellow-600 bg-yellow-100'
      case 'poor': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getQualityLabel = (quality: string | null) => {
    switch (quality) {
      case 'excellent': return '优秀'
      case 'good': return '良好'
      case 'fair': return '一般'
      case 'poor': return '较差'
      default: return '未知'
    }
  }

  const connectionQuality = getConnectionQuality()

  return (
    <div className="space-y-4">
      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="relative">
                {connectionStatus === ConnectionStatus.CONNECTED ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-gray-400" />
                )}
                {isConnecting && (
                  <RefreshCw className="h-3 w-3 text-blue-500 animate-spin absolute -top-1 -right-1" />
                )}
              </div>
              <CardTitle className="text-lg">智能连接管理</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Current Connection Status */}
          {currentNetwork && connectionStatus === ConnectionStatus.CONNECTED ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <Signal className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">{currentNetwork.ssid}</p>
                  <p className="text-sm text-green-700">
                    信号强度: {currentNetwork.signalStrength}%
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {connectionQuality && (
                  <Badge className={getQualityColor(connectionQuality)}>
                    {getQualityLabel(connectionQuality)}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectFromNetwork()}
                >
                  断开
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <WifiOff className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">未连接</p>
                  <p className="text-sm text-gray-600">点击下方按钮开始智能连接</p>
                </div>
              </div>
              <Button
                onClick={() => smartConnect()}
                disabled={isConnecting || availableNetworks.length === 0}
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    连接中...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    智能连接
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Connection Progress */}
          <AnimatePresence>
            {isConnecting && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-sm">
                  <span>连接进度</span>
                  <span>{Math.round(connectionProgress)}%</span>
                </div>
                <Progress value={connectionProgress} className="h-2" />
                {currentAttempt && (
                  <p className="text-sm text-gray-600">
                    正在连接到 {currentAttempt.network.ssid}
                    {currentAttempt.retryCount > 0 && ` (重试 ${currentAttempt.retryCount})`}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Advanced Options */}
          <AnimatePresence>
            {showAdvancedOptions && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t pt-4"
              >
                <h4 className="font-medium mb-3">智能连接选项</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={smartOptions.enableAutoRetry}
                        onChange={(e) => setSmartOptions(prev => ({
                          ...prev,
                          enableAutoRetry: e.target.checked
                        }))}
                        className="rounded"
                      />
                      <span className="text-sm">启用自动重试</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={smartOptions.prioritizeSignalStrength}
                        onChange={(e) => setSmartOptions(prev => ({
                          ...prev,
                          prioritizeSignalStrength: e.target.checked
                        }))}
                        className="rounded"
                      />
                      <span className="text-sm">优先信号强度</span>
                    </label>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={smartOptions.prioritizeSavedNetworks}
                        onChange={(e) => setSmartOptions(prev => ({
                          ...prev,
                          prioritizeSavedNetworks: e.target.checked
                        }))}
                        className="rounded"
                      />
                      <span className="text-sm">优先已保存网络</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={smartOptions.enableFallback}
                        onChange={(e) => setSmartOptions(prev => ({
                          ...prev,
                          enableFallback: e.target.checked
                        }))}
                        className="rounded"
                      />
                      <span className="text-sm">启用备用网络</span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Connection History */}
          {connectionHistory.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">连接历史</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {connectionHistory.slice(0, 5).map((attempt, index) => (
                  <div key={index} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      {attempt.success ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      )}
                      <span>{attempt.network.ssid}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(attempt.startTime).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
