"use client"

import { useEffect } from "react"
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

  const { networks, connectionStatus, currentNetwork, connectionError, isScanning, scanProgress, isOffline } =
    useWifiApi()

  // Sync backend state to Zustand store
  useEffect(() => {
    logger.debug("Syncing backend state to Zustand store")

    // Update available networks
    setAvailableNetworks(networks)

    // Update saved networks
    const savedNetworks = networks.filter((network) => network.saved)
    setSavedNetworks(savedNetworks)

    // Update connection status
    setConnectionStatus(connectionStatus)
    setCurrentNetwork(currentNetwork)
    setConnectionError(connectionError)

    // Update scan status
    setIsScanning(isScanning)
    setScanProgress(scanProgress)

    // Update last scan time if scan completed
    if (!isScanning && scanProgress === 100) {
      setLastScanTime(Date.now())
    }

    // Update offline status
    updateSettings({ isOffline })
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

  // This component doesn't render anything
  return null
}
