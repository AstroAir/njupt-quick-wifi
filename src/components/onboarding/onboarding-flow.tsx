"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  Wifi, 
  Shield, 
  Settings, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Smartphone,
  Monitor,
  Globe
} from "lucide-react"
import { useWifiStore } from "@/store"
import { logger } from "@/lib/logger"

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  content: React.ReactNode
  canSkip?: boolean
  requiresAction?: boolean
}

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0)
  const [, setCompletedSteps] = useState<Set<string>>(new Set())
  const [isVisible, setIsVisible] = useState(false)
  const { updateSettings, autoScanOnStartup } = useWifiStore()

  // Check if onboarding should be shown
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('wifi-onboarding-completed')
    if (!hasCompletedOnboarding) {
      setIsVisible(true)
      logger.info('Starting onboarding flow for new user')
    }
  }, [])

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: '欢迎使用 NJUPT Quick WiFi',
      description: '让我们快速设置您的WiFi管理体验',
      icon: <Wifi className="h-8 w-8 text-blue-500" />,
      content: (
        <div className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
            <Wifi className="h-12 w-12 text-blue-500" />
          </div>
          <p className="text-gray-600">
            这个应用将帮助您轻松管理WiFi连接，自动连接到已保存的网络，并提供强大的网络管理功能。
          </p>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <Smartphone className="h-6 w-6 mx-auto mb-2 text-green-500" />
              <p className="text-sm text-gray-600">移动设备支持</p>
            </div>
            <div className="text-center">
              <Monitor className="h-6 w-6 mx-auto mb-2 text-blue-500" />
              <p className="text-sm text-gray-600">桌面端管理</p>
            </div>
            <div className="text-center">
              <Globe className="h-6 w-6 mx-auto mb-2 text-purple-500" />
              <p className="text-sm text-gray-600">实时同步</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'permissions',
      title: '权限设置',
      description: '为了正常工作，我们需要一些基本权限',
      icon: <Shield className="h-8 w-8 text-green-500" />,
      content: (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Wifi className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">WiFi网络访问</p>
                  <p className="text-sm text-gray-600">扫描和连接WiFi网络</p>
                </div>
              </div>
              <Badge variant="secondary">必需</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Settings className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium">系统设置访问</p>
                  <p className="text-sm text-gray-600">修改网络配置</p>
                </div>
              </div>
              <Badge variant="secondary">必需</Badge>
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <Shield className="h-4 w-4 inline mr-2" />
              我们承诺保护您的隐私，不会收集或传输您的个人数据。
            </p>
          </div>
        </div>
      ),
      requiresAction: true
    },
    {
      id: 'settings',
      title: '基本设置',
      description: '配置您的偏好设置',
      icon: <Settings className="h-8 w-8 text-purple-500" />,
      content: (
        <SettingsStep onSettingsChange={(settings) => updateSettings(settings)} />
      ),
      requiresAction: true
    },
    {
      id: 'complete',
      title: '设置完成',
      description: '您已准备好开始使用WiFi管理器',
      icon: <CheckCircle className="h-8 w-8 text-green-500" />,
      content: (
        <div className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <p className="text-gray-600">
            太棒了！您的WiFi管理器已经配置完成。现在您可以开始扫描和连接WiFi网络了。
          </p>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              💡 提示：您可以随时在设置中修改这些配置。
            </p>
          </div>
        </div>
      )
    }
  ]

  const currentStepData = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  const handleNext = () => {
    if (currentStepData.requiresAction) {
      setCompletedSteps(prev => new Set([...prev, currentStepData.id]))
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeOnboarding()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    completeOnboarding()
  }

  const completeOnboarding = () => {
    localStorage.setItem('wifi-onboarding-completed', 'true')
    setIsVisible(false)
    logger.info('Onboarding completed')
    
    // Enable auto-scan if not already enabled
    if (!autoScanOnStartup) {
      updateSettings({ autoScanOnStartup: true })
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-2xl"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              {currentStepData.icon}
            </div>
            <CardTitle className="text-2xl">{currentStepData.title}</CardTitle>
            <CardDescription>{currentStepData.description}</CardDescription>
            <div className="mt-4">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-gray-500 mt-2">
                步骤 {currentStep + 1} / {steps.length}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {currentStepData.content}
              </motion.div>
            </AnimatePresence>
            
            <div className="flex justify-between mt-8">
              <div className="flex space-x-2">
                {currentStep > 0 && (
                  <Button variant="outline" onClick={handlePrevious}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    上一步
                  </Button>
                )}
                {currentStepData.canSkip !== false && currentStep < steps.length - 1 && (
                  <Button variant="ghost" onClick={handleSkip}>
                    跳过设置
                  </Button>
                )}
              </div>
              
              <Button onClick={handleNext}>
                {currentStep === steps.length - 1 ? '开始使用' : '下一步'}
                {currentStep < steps.length - 1 && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// Settings step component
function SettingsStep({ onSettingsChange }: { onSettingsChange: (settings: Record<string, unknown>) => void }) {
  const [settings, setSettings] = useState({
    autoScanOnStartup: true,
    autoReconnect: true,
    animationsEnabled: true,
    scanInterval: 30000
  })

  useEffect(() => {
    onSettingsChange(settings)
  }, [settings, onSettingsChange])

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">启动时自动扫描</p>
            <p className="text-sm text-gray-600">应用启动时自动扫描可用网络</p>
          </div>
          <input
            type="checkbox"
            checked={settings.autoScanOnStartup}
            onChange={(e) => setSettings(prev => ({ ...prev, autoScanOnStartup: e.target.checked }))}
            className="rounded"
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">自动重连</p>
            <p className="text-sm text-gray-600">连接断开时自动尝试重连</p>
          </div>
          <input
            type="checkbox"
            checked={settings.autoReconnect}
            onChange={(e) => setSettings(prev => ({ ...prev, autoReconnect: e.target.checked }))}
            className="rounded"
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">启用动画</p>
            <p className="text-sm text-gray-600">界面动画和过渡效果</p>
          </div>
          <input
            type="checkbox"
            checked={settings.animationsEnabled}
            onChange={(e) => setSettings(prev => ({ ...prev, animationsEnabled: e.target.checked }))}
            className="rounded"
          />
        </div>
      </div>
    </div>
  )
}
