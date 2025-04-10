"use client"

import { useState, useEffect, useCallback } from "react"
import { apiClient } from "@/lib/api-client"
import { type WiFiNetwork, ConnectionStatus, type NetworkSettings } from "@/lib/types"
import { logger } from "@/lib/logger"

/**
 * Custom hook for interacting with the WiFi API
 */
export function useWifiApi() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [networks, setNetworks] = useState<WiFiNetwork[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED)
  const [currentNetwork, setCurrentNetwork] = useState<WiFiNetwork | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [ipAddress, setIpAddress] = useState<string | null>(null)
  const [signalStrength, setSignalStrength] = useState<number | null>(null)
  const [connectionDuration, setConnectionDuration] = useState<number | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [retryAvailable, setRetryAvailable] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  // Update connection duration periodically
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (connectionStatus === ConnectionStatus.CONNECTED && currentNetwork) {
      interval = setInterval(() => {
        apiClient
          .getConnectionStatus()
          .then((status) => {
            setConnectionDuration(status.connectionDuration)
          })
          .catch((err) => {
            logger.error("Failed to update connection duration", err)
          })
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [connectionStatus, currentNetwork])

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      logger.info("Device is online, refreshing connection status")
      fetchConnectionStatus()
    }

    const handleOffline = () => {
      setIsOffline(true)
      logger.warn("Device is offline")
    }

    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine)
      window.addEventListener("online", handleOnline)
      window.addEventListener("offline", handleOffline)
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline)
        window.removeEventListener("offline", handleOffline)
      }
    }
  }, [])

  // Fetch networks
  const fetchNetworks = useCallback(async () => {
    if (isOffline) {
      logger.warn("Device is offline, skipping network fetch")
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const networks = await apiClient.getNetworks()
      setNetworks(networks)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch networks")
    } finally {
      setIsLoading(false)
    }
  }, [isOffline])

  // Fetch connection status
  const fetchConnectionStatus = useCallback(async () => {
    if (isOffline) {
      logger.warn("Device is offline, skipping connection status fetch")
      return
    }

    try {
      const status = await apiClient.getConnectionStatus()
      setConnectionStatus(status.connectionStatus)
      setCurrentNetwork(status.currentNetwork)
      setConnectionError(status.connectionError)
      setIpAddress(status.ipAddress)
      setSignalStrength(status.signalStrength)
      setConnectionDuration(status.connectionDuration)
      setRetryCount(status.retryCount)
      setRetryAvailable(status.retryAvailable)
    } catch (err) {
      logger.error("Failed to fetch connection status", err)
    }
  }, [isOffline])

  // Start a network scan
  const startScan = useCallback(async () => {
    if (isOffline) {
      logger.warn("Device is offline, cannot start scan")
      setError("Cannot scan while offline")
      return
    }

    if (isScanning) return

    setIsScanning(true)
    setScanProgress(0)
    setError(null)

    try {
      await apiClient.startScan()

      // Poll for scan status
      const intervalId = setInterval(async () => {
        try {
          const status = await apiClient.getScanStatus()
          setScanProgress(status.scanProgress)

          if (!status.isScanning) {
            clearInterval(intervalId)
            setIsScanning(false)
            fetchNetworks() // Refresh networks after scan completes
          }
        } catch (err) {
          clearInterval(intervalId)
          setIsScanning(false)
          setError(err instanceof Error ? err.message : "Failed to get scan status")
        }
      }, 500)

      // Cleanup interval on error
      return () => clearInterval(intervalId)
    } catch (err) {
      setIsScanning(false)
      setError(err instanceof Error ? err.message : "Failed to start scan")
    }
  }, [isScanning, fetchNetworks, isOffline])

  // Connect to a network
  const connectToNetwork = useCallback(
    async (network: WiFiNetwork, password?: string, saveNetwork = true) => {
      if (isOffline) {
        logger.warn("Device is offline, cannot connect to network")
        setError("Cannot connect while offline")
        return
      }

      setError(null)
      setConnectionError(null)
      setConnectionStatus(ConnectionStatus.CONNECTING)

      try {
        await apiClient.connectToNetwork(network, password, saveNetwork)

        // Poll for connection status
        const intervalId = setInterval(async () => {
          try {
            const status = await apiClient.getConnectionStatus()
            setConnectionStatus(status.connectionStatus)
            setCurrentNetwork(status.currentNetwork)
            setConnectionError(status.connectionError)
            setIpAddress(status.ipAddress)
            setSignalStrength(status.signalStrength)
            setConnectionDuration(status.connectionDuration)
            setRetryCount(status.retryCount)
            setRetryAvailable(status.retryAvailable)

            if (
              status.connectionStatus === ConnectionStatus.CONNECTED ||
              status.connectionStatus === ConnectionStatus.ERROR ||
              status.connectionStatus === ConnectionStatus.DISCONNECTED
            ) {
              clearInterval(intervalId)
            }
          } catch (err) {
            clearInterval(intervalId)
            setConnectionStatus(ConnectionStatus.ERROR)
            setConnectionError(err instanceof Error ? err.message : "Failed to get connection status")
          }
        }, 500)

        // Cleanup interval on error
        return () => clearInterval(intervalId)
      } catch (err) {
        setConnectionStatus(ConnectionStatus.ERROR)
        setConnectionError(err instanceof Error ? err.message : "Failed to connect to network")
      }
    },
    [isOffline],
  )

  // Disconnect from the current network
  const disconnectFromNetwork = useCallback(async () => {
    if (isOffline) {
      logger.warn("Device is offline, cannot disconnect from network")
      setError("Cannot disconnect while offline")
      return
    }

    setError(null)

    try {
      await apiClient.disconnectFromNetwork()
      setConnectionStatus(ConnectionStatus.DISCONNECTED)
      setCurrentNetwork(null)
      setIpAddress(null)
      setSignalStrength(null)
      setConnectionDuration(null)
      setRetryCount(0)
      setRetryAvailable(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect from network")
    }
  }, [isOffline])

  // Forget a network
  const forgetNetwork = useCallback(
    async (network: WiFiNetwork) => {
      if (isOffline) {
        logger.warn("Device is offline, cannot forget network")
        setError("Cannot forget network while offline")
        return
      }

      setError(null)

      try {
        await apiClient.forgetNetwork(network.bssid)

        // If this was the current network, disconnect
        if (currentNetwork?.bssid === network.bssid) {
          setConnectionStatus(ConnectionStatus.DISCONNECTED)
          setCurrentNetwork(null)
          setIpAddress(null)
          setSignalStrength(null)
          setConnectionDuration(null)
        }

        // Refresh networks
        fetchNetworks()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to forget network")
      }
    },
    [currentNetwork, fetchNetworks, isOffline],
  )

  // Update network settings
  const updateNetworkSettings = useCallback(
    async (network: WiFiNetwork, settings: Partial<NetworkSettings>) => {
      if (isOffline) {
        logger.warn("Device is offline, cannot update network settings")
        setError("Cannot update settings while offline")
        return
      }

      setError(null)

      try {
        await apiClient.updateNetworkSettings(network.bssid, settings)

        // Refresh networks
        fetchNetworks()

        // If this is the current network, refresh connection status
        if (currentNetwork?.bssid === network.bssid) {
          fetchConnectionStatus()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update network settings")
      }
    },
    [fetchNetworks, currentNetwork, fetchConnectionStatus, isOffline],
  )

  // Add a manual network
  const addManualNetwork = useCallback(
    async (ssid: string, security: string, password?: string) => {
      if (isOffline) {
        logger.warn("Device is offline, cannot add manual network")
        setError("Cannot add network while offline")
        return
      }

      setError(null)

      try {
        await apiClient.addManualNetwork(ssid, security, password)

        // Refresh networks
        fetchNetworks()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add manual network")
      }
    },
    [fetchNetworks, isOffline],
  )

  // Set up WebSocket for real-time updates
  useEffect(() => {
    const cleanup = apiClient.setupWebSocket({
      onScanUpdate: (data) => {
        setIsScanning(data.isScanning)
        setScanProgress(data.progress || 0)
        if (!data.isScanning) {
          fetchNetworks() // Refresh networks when scan completes
        }
      },
      onConnectionUpdate: (data) => {
        setConnectionStatus(data.connectionStatus)
        setCurrentNetwork(data.currentNetwork)
        setConnectionError(data.connectionError)
        setIpAddress(data.ipAddress)
        setSignalStrength(data.signalStrength)
        setConnectionDuration(data.connectionDuration)
        setRetryCount(data.retryCount)
        setRetryAvailable(data.retryAvailable)
      },
      onNetworkUpdate: () => {
        fetchNetworks() // Refresh networks when they change
      },
      onError: (error) => {
        logger.error("WebSocket error", error)
        setError("Connection to server lost. Some features may be unavailable.")
      },
    })

    return cleanup
  }, [fetchNetworks])

  // Initial data fetch
  useEffect(() => {
    fetchNetworks()
    fetchConnectionStatus()
  }, [fetchNetworks, fetchConnectionStatus])

  return {
    isLoading,
    error,
    networks,
    isScanning,
    scanProgress,
    connectionStatus,
    currentNetwork,
    connectionError,
    ipAddress,
    signalStrength,
    connectionDuration,
    retryCount,
    retryAvailable,
    isOffline,
    fetchNetworks,
    startScan,
    connectToNetwork,
    disconnectFromNetwork,
    forgetNetwork,
    updateNetworkSettings,
    addManualNetwork,
  }
}
