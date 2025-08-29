"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Lightbulb, 
  X, 
  AlertCircle,
  Info,
  ArrowRight,
  Target,
  Zap
} from "lucide-react"
import { useWifiStore } from "@/store"
import { ConnectionStatus } from "@/types"

interface GuidanceStep {
  id: string
  title: string
  description: string
  action?: string
  actionLabel?: string
  condition?: () => boolean
  completed?: () => boolean
  priority: 'low' | 'medium' | 'high'
  category: 'setup' | 'usage' | 'optimization' | 'security'
}

interface SmartSuggestion {
  id: string
  title: string
  description: string
  action: () => void
  actionLabel: string
  type: 'tip' | 'warning' | 'optimization'
  dismissible: boolean
}

export function UserGuidance() {
  const [activeGuidance, setActiveGuidance] = useState<GuidanceStep | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())
  const [showGuidance, setShowGuidance] = useState(true)
  
  const { 
    availableNetworks, 
    savedNetworks, 
    currentNetwork, 
    connectionStatus,
    autoScanOnStartup,
    autoReconnect,
    scanNetworks,
    updateSettings
  } = useWifiStore()

  const guidanceSteps: GuidanceStep[] = useMemo(() => [
    {
      id: 'first-scan',
      title: '扫描WiFi网络',
      description: '开始扫描附近的WiFi网络以查看可用选项',
      action: 'scan',
      actionLabel: '开始扫描',
      condition: () => availableNetworks.length === 0,
      completed: () => availableNetworks.length > 0,
      priority: 'high',
      category: 'setup'
    },
    {
      id: 'first-connection',
      title: '连接到网络',
      description: '选择一个网络并连接以开始使用互联网',
      condition: () => availableNetworks.length > 0 && connectionStatus === ConnectionStatus.DISCONNECTED,
      completed: () => connectionStatus === ConnectionStatus.CONNECTED,
      priority: 'high',
      category: 'setup'
    },
    {
      id: 'save-network',
      title: '保存常用网络',
      description: '保存您经常使用的网络以便快速连接',
      condition: () => connectionStatus === ConnectionStatus.CONNECTED && savedNetworks.length === 0,
      completed: () => savedNetworks.length > 0,
      priority: 'medium',
      category: 'usage'
    },
    {
      id: 'enable-auto-scan',
      title: '启用自动扫描',
      description: '开启自动扫描以便应用启动时自动查找网络',
      action: 'enable-auto-scan',
      actionLabel: '启用自动扫描',
      condition: () => !autoScanOnStartup,
      completed: () => autoScanOnStartup,
      priority: 'medium',
      category: 'optimization'
    },
    {
      id: 'enable-auto-reconnect',
      title: '启用自动重连',
      description: '开启自动重连以便在连接断开时自动尝试重新连接',
      action: 'enable-auto-reconnect',
      actionLabel: '启用自动重连',
      condition: () => !autoReconnect,
      completed: () => autoReconnect,
      priority: 'medium',
      category: 'optimization'
    }
  ], [autoReconnect, autoScanOnStartup, availableNetworks.length, connectionStatus, savedNetworks.length])

  const smartSuggestions: SmartSuggestion[] = [
    {
      id: 'weak-signal-warning',
      title: '信号较弱',
      description: '当前网络信号较弱，可能影响连接稳定性。建议寻找信号更强的网络。',
      action: () => scanNetworks(),
      actionLabel: '扫描更好的网络',
      type: 'warning',
      dismissible: true
    },
    {
      id: 'multiple-saved-networks',
      title: '优化网络优先级',
      description: '您保存了多个网络，可以设置优先级以便自动选择最佳网络。',
      action: () => {}, // Navigate to settings
      actionLabel: '设置优先级',
      type: 'optimization',
      dismissible: true
    },
    {
      id: 'security-recommendation',
      title: '安全建议',
      description: '建议避免连接开放的WiFi网络，优先选择加密的网络以保护您的数据安全。',
      action: () => {}, // Show security guide
      actionLabel: '了解更多',
      type: 'tip',
      dismissible: true
    }
  ]

  // Find the next guidance step to show
  useEffect(() => {
    const nextStep = guidanceSteps.find(step => 
      !completedSteps.has(step.id) && 
      step.condition?.() !== false &&
      !step.completed?.()
    )
    
    if (nextStep && nextStep !== activeGuidance) {
      setActiveGuidance(nextStep)
    } else if (!nextStep) {
      setActiveGuidance(null)
    }
  }, [availableNetworks, savedNetworks, connectionStatus, autoScanOnStartup, autoReconnect, completedSteps, activeGuidance, guidanceSteps])

  // Mark completed steps
  useEffect(() => {
    guidanceSteps.forEach(step => {
      if (step.completed?.() && !completedSteps.has(step.id)) {
        setCompletedSteps(prev => new Set([...prev, step.id]))
      }
    })
  }, [availableNetworks, savedNetworks, connectionStatus, autoScanOnStartup, autoReconnect, completedSteps, guidanceSteps])

  const handleAction = (action: string) => {
    switch (action) {
      case 'scan':
        scanNetworks()
        break
      case 'enable-auto-scan':
        updateSettings({ autoScanOnStartup: true })
        break
      case 'enable-auto-reconnect':
        updateSettings({ autoReconnect: true })
        break
    }
  }

  const handleDismissStep = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]))
    setActiveGuidance(null)
  }

  const handleDismissSuggestion = (suggestionId: string) => {
    setDismissedSuggestions(prev => new Set([...prev, suggestionId]))
  }

  const getActiveSuggestions = () => {
    return smartSuggestions.filter(suggestion => {
      if (dismissedSuggestions.has(suggestion.id)) return false
      
      switch (suggestion.id) {
        case 'weak-signal-warning':
          return currentNetwork && currentNetwork.signalStrength < 30
        case 'multiple-saved-networks':
          return savedNetworks.length > 2
        case 'security-recommendation':
          return availableNetworks.some(network => network.security === 'Open')
        default:
          return false
      }
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertCircle className="h-5 w-5 text-orange-500" />
      case 'optimization': return <Zap className="h-5 w-5 text-blue-500" />
      case 'tip': return <Lightbulb className="h-5 w-5 text-yellow-500" />
      default: return <Info className="h-5 w-5 text-gray-500" />
    }
  }

  const completedCount = completedSteps.size
  const totalSteps = guidanceSteps.length
  const progressPercentage = (completedCount / totalSteps) * 100

  if (!showGuidance) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowGuidance(true)}
        className="fixed bottom-16 right-4 z-30 bg-white shadow-lg border"
      >
        <Target className="h-4 w-4 mr-2" />
        指导
      </Button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 space-y-3 max-w-sm">
      {/* Progress indicator */}
      {totalSteps > 0 && (
        <Card className="bg-white shadow-lg border">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">设置进度</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGuidance(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <Progress value={progressPercentage} className="h-2 mb-2" />
            <p className="text-xs text-gray-600">
              已完成 {completedCount} / {totalSteps} 个设置步骤
            </p>
          </CardContent>
        </Card>
      )}

      {/* Active guidance step */}
      <AnimatePresence>
        {activeGuidance && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-white shadow-lg border-2 border-blue-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-sm">{activeGuidance.title}</CardTitle>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getPriorityColor(activeGuidance.priority)}>
                      {activeGuidance.priority === 'high' ? '重要' : 
                       activeGuidance.priority === 'medium' ? '建议' : '可选'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismissStep(activeGuidance.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="mb-3">
                  {activeGuidance.description}
                </CardDescription>
                {activeGuidance.action && (
                  <Button
                    size="sm"
                    onClick={() => handleAction(activeGuidance.action!)}
                    className="w-full"
                  >
                    {activeGuidance.actionLabel}
                    <ArrowRight className="h-3 w-3 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart suggestions */}
      <AnimatePresence>
        {getActiveSuggestions().map((suggestion) => (
          <motion.div
            key={suggestion.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-white shadow-lg border">
              <CardContent className="p-3">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getSuggestionIcon(suggestion.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm mb-1">{suggestion.title}</h4>
                    <p className="text-xs text-gray-600 mb-3">{suggestion.description}</p>
                    <div className="flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={suggestion.action}
                        className="text-xs"
                      >
                        {suggestion.actionLabel}
                      </Button>
                      {suggestion.dismissible && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismissSuggestion(suggestion.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
