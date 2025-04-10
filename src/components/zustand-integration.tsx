"use client"

import { useEffect, useState } from "react"
import { useWifiStore } from "@/store"
import { useWifiApi } from "@/hooks/use-wifi-api"
import { logger } from "@/lib/logger"

/**
 * Component to integrate the Zustand store with the backend API
 * This acts as a bridge between the frontend state and the backend
 */
export function ZustandIntegration() {
  const {
    setAvailableNetworks,
    setSavedNetworks,
    setCurrentNetwork,
    setConnectionStatus,
    setConnectionError,
    setIsScanning,
    setScanProgress,
    setLastScanTime,
    updateSettings,
  } = useWifiStore()

  const { 
    networks, 
    connectionStatus, 
    currentNetwork, 
    connectionError, 
    isScanning, 
    scanProgress, 
    isOffline 
  } = useWifiApi()

  const [syncErrors, setSyncErrors] = useState<string[]>([])
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)

  // 记录同步错误
  const recordSyncError = (errorType: string, error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`Sync error (${errorType}):`, errorMessage)
    setSyncErrors(prev => [...prev, `${errorType}: ${errorMessage}`])
  }

  // 清除过旧的同步错误
  useEffect(() => {
    if (syncErrors.length > 0) {
      const timerId = setTimeout(() => {
        // 保留最近的5条错误
        setSyncErrors(prev => prev.slice(-5))
      }, 60000) // 1分钟后清理错误

      return () => clearTimeout(timerId)
    }
  }, [syncErrors])

  // 同步后端状态到Zustand store
  useEffect(() => {
    logger.debug("正在同步后端状态到Zustand store")
    
    try {
      // 更新可用网络
      if (Array.isArray(networks)) {
        setAvailableNetworks(networks)
      
        // 更新已保存网络
        try {
          const savedNetworks = networks.filter((network) => network.saved)
          setSavedNetworks(savedNetworks)
        } catch (error) {
          recordSyncError("saved-networks", error)
        }
      } else {
        logger.warn("获取到无效的网络列表", networks)
      }
    } catch (error) {
      recordSyncError("available-networks", error)
    }

    try {
      // 更新连接状态
      setConnectionStatus(connectionStatus)
    } catch (error) {
      recordSyncError("connection-status", error)
    }

    try {
      // 更新当前网络
      setCurrentNetwork(currentNetwork)
    } catch (error) {
      recordSyncError("current-network", error)
    }

    try {
      // 更新连接错误
      setConnectionError(connectionError)
    } catch (error) {
      recordSyncError("connection-error", error)
    }

    try {
      // 更新扫描状态
      setIsScanning(isScanning)
      setScanProgress(scanProgress)
  
      // 更新最近扫描时间（如果扫描完成）
      if (!isScanning && scanProgress === 100) {
        setLastScanTime(Date.now())
      }
    } catch (error) {
      recordSyncError("scan-status", error)
    }

    try {
      // 更新离线状态
      updateSettings({ isOffline })
    } catch (error) {
      recordSyncError("offline-status", error)
    }

    // 记录最近同步时间
    setLastSyncTime(Date.now())
  }, [
    networks,
    connectionStatus,
    currentNetwork,
    connectionError,
    isScanning,
    scanProgress,
    isOffline,
    setAvailableNetworks,
    setSavedNetworks,
    setCurrentNetwork,
    setConnectionStatus,
    setConnectionError,
    setIsScanning,
    setScanProgress,
    setLastScanTime,
    updateSettings,
  ])

  // 记录同步错误和状态日志
  useEffect(() => {
    if (syncErrors.length > 0) {
      logger.warn("状态同步存在错误:", { errors: syncErrors, lastSync: lastSyncTime })
    } 
    
    if (lastSyncTime) {
      const timeSinceLastSync = Date.now() - lastSyncTime
      // 如果最后同步时间超过30秒，记录警告
      if (timeSinceLastSync > 30000) {
        logger.warn("状态同步延迟:", { timeSinceLastSync, lastSync: new Date(lastSyncTime).toISOString() })
      }
    }
  }, [syncErrors, lastSyncTime])

  // 在应用激活时重新同步
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.info("应用恢复前台，重新同步状态")
        // 重置同步时间会触发下一个渲染周期的重新同步
        setLastSyncTime(null)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // 这个组件不渲染任何内容
  return null
}
