"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  AlertTriangle,
  RefreshCw,
  Wifi,
  Settings,
  HelpCircle,
  CheckCircle,
  X,
  Router,
  Shield
} from "lucide-react"
import { useWifiStore } from "@/store"

import { logger } from "@/lib/logger"
import { toast } from "sonner"

interface ErrorInfo {
  code: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'connection' | 'authentication' | 'network' | 'system' | 'configuration'
  timestamp: number
  context?: Record<string, unknown>
}

interface RecoveryAction {
  id: string
  label: string
  description: string
  action: () => Promise<boolean>
  icon: React.ReactNode
  estimatedTime: number
  successRate: number
}

interface RecoveryPlan {
  errorCode: string
  title: string
  description: string
  actions: RecoveryAction[]
  preventionTips: string[]
}

export function ErrorRecovery() {
  const [currentError, setCurrentError] = useState<ErrorInfo | null>(null)
  const [recoveryPlan, setRecoveryPlan] = useState<RecoveryPlan | null>(null)
  const [isRecovering, setIsRecovering] = useState(false)
  const [recoveryProgress, setRecoveryProgress] = useState(0)
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set())
  const [showErrorDetails, setShowErrorDetails] = useState(false)

  const { 
    connectionStatus, 
    connectionError, 
    currentNetwork,
    scanNetworks,
    connectToNetwork,
    disconnectFromNetwork
  } = useWifiStore()

  const recoveryPlans: Record<string, RecoveryPlan> = useMemo(() => ({
    'CONNECTION_FAILED': {
      errorCode: 'CONNECTION_FAILED',
      title: '连接失败',
      description: '无法连接到选定的WiFi网络',
      actions: [
        {
          id: 'verify-password',
          label: '验证密码',
          description: '检查并重新输入网络密码',
          action: async () => {
            // This would trigger password re-entry dialog
            return true
          },
          icon: <Shield className="h-4 w-4" />,
          estimatedTime: 30,
          successRate: 70
        },
        {
          id: 'restart-wifi',
          label: '重启WiFi适配器',
          description: '重新启动WiFi适配器以解决连接问题',
          action: async () => {
            await new Promise(resolve => setTimeout(resolve, 2000))
            return Math.random() > 0.3
          },
          icon: <RefreshCw className="h-4 w-4" />,
          estimatedTime: 10,
          successRate: 60
        },
        {
          id: 'forget-reconnect',
          label: '忘记并重新连接',
          description: '删除网络配置并重新建立连接',
          action: async () => {
            if (currentNetwork) {
              // Forget and reconnect logic
              await new Promise(resolve => setTimeout(resolve, 3000))
              return Math.random() > 0.2
            }
            return false
          },
          icon: <Wifi className="h-4 w-4" />,
          estimatedTime: 45,
          successRate: 80
        }
      ],
      preventionTips: [
        '确保输入正确的网络密码',
        '检查网络信号强度是否足够',
        '确认网络支持您的设备类型'
      ]
    },
    'WEAK_SIGNAL': {
      errorCode: 'WEAK_SIGNAL',
      title: '信号较弱',
      description: '当前网络信号强度不足，可能影响连接稳定性',
      actions: [
        {
          id: 'move-closer',
          label: '改善信号',
          description: '移动到更靠近路由器的位置',
          action: async () => {
            toast.info('请移动到更靠近WiFi路由器的位置')
            await new Promise(resolve => setTimeout(resolve, 5000))
            return true
          },
          icon: <Router className="h-4 w-4" />,
          estimatedTime: 60,
          successRate: 90
        },
        {
          id: 'scan-alternatives',
          label: '扫描更好的网络',
          description: '查找信号更强的替代网络',
          action: async () => {
            await scanNetworks()
            return true
          },
          icon: <Wifi className="h-4 w-4" />,
          estimatedTime: 15,
          successRate: 85
        }
      ],
      preventionTips: [
        '尽量靠近WiFi路由器使用',
        '避免在有障碍物的地方使用',
        '考虑使用WiFi扩展器'
      ]
    },
    'AUTHENTICATION_FAILED': {
      errorCode: 'AUTHENTICATION_FAILED',
      title: '认证失败',
      description: '网络密码错误或认证方式不匹配',
      actions: [
        {
          id: 'check-password',
          label: '检查密码',
          description: '确认网络密码是否正确',
          action: async () => {
            // Trigger password verification
            return true
          },
          icon: <Shield className="h-4 w-4" />,
          estimatedTime: 30,
          successRate: 95
        },
        {
          id: 'check-security-type',
          label: '检查安全类型',
          description: '确认网络的安全加密类型',
          action: async () => {
            // Check and adjust security settings
            return true
          },
          icon: <Settings className="h-4 w-4" />,
          estimatedTime: 20,
          successRate: 75
        }
      ],
      preventionTips: [
        '仔细检查密码的大小写',
        '确认密码中的特殊字符',
        '联系网络管理员确认密码'
      ]
    },
    'NO_INTERNET': {
      errorCode: 'NO_INTERNET',
      title: '无法访问互联网',
      description: '已连接到WiFi但无法访问互联网',
      actions: [
        {
          id: 'check-router',
          label: '检查路由器',
          description: '确认路由器是否正常工作',
          action: async () => {
            toast.info('请检查路由器指示灯是否正常')
            await new Promise(resolve => setTimeout(resolve, 3000))
            return true
          },
          icon: <Router className="h-4 w-4" />,
          estimatedTime: 60,
          successRate: 70
        },
        {
          id: 'reconnect-network',
          label: '重新连接',
          description: '断开并重新连接到网络',
          action: async () => {
            if (currentNetwork) {
              await disconnectFromNetwork()
              await new Promise(resolve => setTimeout(resolve, 2000))
              await connectToNetwork(currentNetwork, '')
              return true
            }
            return false
          },
          icon: <RefreshCw className="h-4 w-4" />,
          estimatedTime: 30,
          successRate: 60
        }
      ],
      preventionTips: [
        '定期重启路由器',
        '检查网络服务商状态',
        '确认路由器配置正确'
      ]
    }
  }), [connectToNetwork, currentNetwork, disconnectFromNetwork, scanNetworks])

  // Detect errors and create error info
  useEffect(() => {
    if (connectionError) {
      const errorInfo: ErrorInfo = {
        code: determineErrorCode(connectionError),
        message: connectionError,
        severity: determineSeverity(connectionError),
        category: determineCategory(connectionError),
        timestamp: Date.now(),
        context: {
          connectionStatus,
          currentNetwork: currentNetwork?.ssid,
          signalStrength: currentNetwork?.signalStrength
        }
      }
      
      setCurrentError(errorInfo)
      setRecoveryPlan(recoveryPlans[errorInfo.code] || null)
      logger.error('WiFi error detected', errorInfo)
    } else {
      setCurrentError(null)
      setRecoveryPlan(null)
    }
  }, [connectionError, connectionStatus, currentNetwork, recoveryPlans])

  const determineErrorCode = (error: string): string => {
    if (error.includes('password') || error.includes('authentication')) {
      return 'AUTHENTICATION_FAILED'
    }
    if (error.includes('signal') || error.includes('weak')) {
      return 'WEAK_SIGNAL'
    }
    if (error.includes('internet') || error.includes('dns')) {
      return 'NO_INTERNET'
    }
    return 'CONNECTION_FAILED'
  }

  const determineSeverity = (error: string): 'low' | 'medium' | 'high' | 'critical' => {
    if (error.includes('critical') || error.includes('system')) return 'critical'
    if (error.includes('failed') || error.includes('timeout')) return 'high'
    if (error.includes('slow') || error.includes('weak')) return 'medium'
    return 'low'
  }

  const determineCategory = (error: string): 'connection' | 'authentication' | 'network' | 'system' | 'configuration' => {
    if (error.includes('password') || error.includes('auth')) return 'authentication'
    if (error.includes('network') || error.includes('dns')) return 'network'
    if (error.includes('system') || error.includes('driver')) return 'system'
    if (error.includes('config') || error.includes('setting')) return 'configuration'
    return 'connection'
  }

  const executeRecoveryAction = async (action: RecoveryAction) => {
    setIsRecovering(true)
    setRecoveryProgress(0)
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setRecoveryProgress(prev => Math.min(prev + 10, 90))
      }, action.estimatedTime * 100)

      const success = await action.action()
      
      clearInterval(progressInterval)
      setRecoveryProgress(100)
      
      if (success) {
        setCompletedActions(prev => new Set([...prev, action.id]))
        toast.success(`${action.label} 执行成功`)
        
        // Check if error is resolved
        setTimeout(() => {
          if (!connectionError) {
            setCurrentError(null)
            setRecoveryPlan(null)
            toast.success('问题已解决！')
          }
        }, 2000)
      } else {
        toast.error(`${action.label} 执行失败，请尝试其他方法`)
      }
    } catch (error) {
      logger.error('Recovery action failed', error)
      toast.error('恢复操作失败')
    } finally {
      setIsRecovering(false)
      setRecoveryProgress(0)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return '严重'
      case 'high': return '高'
      case 'medium': return '中等'
      case 'low': return '轻微'
      default: return '未知'
    }
  }

  if (!currentError || !recoveryPlan) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden"
      >
        <Card className="border-2 border-orange-200">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
                <div>
                  <CardTitle className="text-xl">{recoveryPlan.title}</CardTitle>
                  <CardDescription className="mt-1">{recoveryPlan.description}</CardDescription>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge className={getSeverityColor(currentError.severity)}>
                      {getSeverityLabel(currentError.severity)}
                    </Badge>
                    <Badge variant="outline">
                      {new Date(currentError.timestamp).toLocaleTimeString()}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentError(null)
                  setRecoveryPlan(null)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Recovery Actions */}
            <div>
              <h3 className="font-semibold mb-3">推荐解决方案</h3>
              <div className="space-y-3">
                {recoveryPlan.actions.map((action) => (
                  <Card 
                    key={action.id}
                    className={`cursor-pointer transition-all ${
                      completedActions.has(action.id) 
                        ? 'bg-green-50 border-green-200' 
                        : 'hover:shadow-md'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {completedActions.has(action.id) ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              action.icon
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{action.label}</h4>
                            <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                            <div className="flex items-center space-x-4 mt-2">
                              <Badge variant="outline" className="text-xs">
                                ~{action.estimatedTime}秒
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                成功率 {action.successRate}%
                              </Badge>
                            </div>
                          </div>
                        </div>
                        
                        {!completedActions.has(action.id) && (
                          <Button
                            size="sm"
                            onClick={() => executeRecoveryAction(action)}
                            disabled={isRecovering}
                          >
                            {isRecovering ? (
                              <>
                                <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                                执行中...
                              </>
                            ) : (
                              '执行'
                            )}
                          </Button>
                        )}
                      </div>
                      
                      {isRecovering && (
                        <div className="mt-3">
                          <Progress value={recoveryProgress} className="h-2" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Prevention Tips */}
            <div>
              <h3 className="font-semibold mb-3">预防建议</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <ul className="space-y-2">
                  {recoveryPlan.preventionTips.map((tip, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                      <span className="text-blue-800">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Error Details */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="text-gray-600"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                {showErrorDetails ? '隐藏' : '显示'}错误详情
              </Button>
              
              <AnimatePresence>
                {showErrorDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3"
                  >
                    <Card className="bg-gray-50">
                      <CardContent className="p-3">
                        <div className="text-xs space-y-2">
                          <div><strong>错误代码:</strong> {currentError.code}</div>
                          <div><strong>错误消息:</strong> {currentError.message}</div>
                          <div><strong>分类:</strong> {currentError.category}</div>
                          <div><strong>时间:</strong> {new Date(currentError.timestamp).toLocaleString()}</div>
                          {currentError.context && (
                            <div>
                              <strong>上下文:</strong>
                              <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-x-auto">
                                {JSON.stringify(currentError.context, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
