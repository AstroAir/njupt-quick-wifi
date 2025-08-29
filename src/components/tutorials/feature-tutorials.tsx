"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Play,
  RotateCcw,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Wifi,
  Settings,
  Shield,
  Zap
} from "lucide-react"

interface TutorialStep {
  id: string
  title: string
  description: string
  target?: string
  action?: string
  highlight?: boolean
  duration?: number
}

interface Tutorial {
  id: string
  title: string
  description: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: number
  steps: TutorialStep[]
  icon: React.ReactNode
}

export function FeatureTutorials() {
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [completedTutorials, setCompletedTutorials] = useState<Set<string>>(new Set())
  const [showTutorials, setShowTutorials] = useState(false)

  const tutorials: Tutorial[] = [
    {
      id: 'basic-connection',
      title: '基础连接教程',
      description: '学习如何扫描和连接WiFi网络',
      category: '基础功能',
      difficulty: 'beginner',
      estimatedTime: 3,
      icon: <Wifi className="h-5 w-5" />,
      steps: [
        {
          id: 'scan-intro',
          title: '扫描网络',
          description: '首先，我们需要扫描附近的WiFi网络。点击"扫描"按钮开始。',
          target: '[data-tutorial="scan-button"]',
          highlight: true
        },
        {
          id: 'network-list',
          title: '查看网络列表',
          description: '扫描完成后，您会看到附近所有可用的WiFi网络列表。',
          target: '[data-tutorial="network-list"]',
          highlight: true
        },
        {
          id: 'select-network',
          title: '选择网络',
          description: '点击您想要连接的网络。如果网络需要密码，会弹出连接对话框。',
          target: '[data-tutorial="network-item"]',
          highlight: true
        },
        {
          id: 'enter-password',
          title: '输入密码',
          description: '在连接对话框中输入网络密码，然后点击"连接"。',
          target: '[data-tutorial="connect-dialog"]',
          highlight: true
        },
        {
          id: 'connection-status',
          title: '查看连接状态',
          description: '连接成功后，您可以在顶部看到当前的连接状态和网络信息。',
          target: '[data-tutorial="connection-status"]',
          highlight: true
        }
      ]
    },
    {
      id: 'network-management',
      title: '网络管理',
      description: '学习如何保存、管理和配置WiFi网络',
      category: '网络管理',
      difficulty: 'intermediate',
      estimatedTime: 5,
      icon: <Settings className="h-5 w-5" />,
      steps: [
        {
          id: 'save-network',
          title: '保存网络',
          description: '连接到网络后，可以选择保存网络以便下次自动连接。',
          target: '[data-tutorial="save-network"]',
          highlight: true
        },
        {
          id: 'saved-networks',
          title: '查看已保存网络',
          description: '在"已保存网络"标签中可以查看和管理所有保存的网络。',
          target: '[data-tutorial="saved-networks"]',
          highlight: true
        },
        {
          id: 'network-settings',
          title: '网络设置',
          description: '点击网络旁的设置按钮可以配置自动连接、优先级等选项。',
          target: '[data-tutorial="network-settings"]',
          highlight: true
        },
        {
          id: 'forget-network',
          title: '忘记网络',
          description: '如果不再需要某个网络，可以选择"忘记"来删除它。',
          target: '[data-tutorial="forget-network"]',
          highlight: true
        }
      ]
    },
    {
      id: 'security-features',
      title: '安全功能',
      description: '了解WiFi安全功能和最佳实践',
      category: '安全',
      difficulty: 'intermediate',
      estimatedTime: 4,
      icon: <Shield className="h-5 w-5" />,
      steps: [
        {
          id: 'security-indicators',
          title: '安全指示器',
          description: '网络列表中的锁图标表示网络的安全类型。',
          target: '[data-tutorial="security-icon"]',
          highlight: true
        },
        {
          id: 'open-networks',
          title: '开放网络警告',
          description: '连接开放网络时会显示安全警告，建议谨慎使用。',
          target: '[data-tutorial="security-warning"]',
          highlight: true
        },
        {
          id: 'secure-storage',
          title: '安全存储',
          description: '在设置中可以启用安全存储来加密保存的密码。',
          target: '[data-tutorial="secure-storage"]',
          highlight: true
        }
      ]
    },
    {
      id: 'advanced-features',
      title: '高级功能',
      description: '探索高级设置和自动化功能',
      category: '高级',
      difficulty: 'advanced',
      estimatedTime: 6,
      icon: <Zap className="h-5 w-5" />,
      steps: [
        {
          id: 'auto-scan',
          title: '自动扫描',
          description: '启用自动扫描可以让应用定期查找新的网络。',
          target: '[data-tutorial="auto-scan"]',
          highlight: true
        },
        {
          id: 'auto-reconnect',
          title: '自动重连',
          description: '自动重连功能会在连接断开时尝试重新连接。',
          target: '[data-tutorial="auto-reconnect"]',
          highlight: true
        },
        {
          id: 'network-priority',
          title: '网络优先级',
          description: '设置网络优先级可以控制自动连接的顺序。',
          target: '[data-tutorial="network-priority"]',
          highlight: true
        },
        {
          id: 'filters',
          title: '网络筛选',
          description: '使用筛选器可以快速找到特定类型的网络。',
          target: '[data-tutorial="network-filters"]',
          highlight: true
        }
      ]
    }
  ]

  useEffect(() => {
    // Load completed tutorials from localStorage
    const completed = localStorage.getItem('completed-tutorials')
    if (completed) {
      setCompletedTutorials(new Set(JSON.parse(completed)))
    }
  }, [])

  useEffect(() => {
    // Save completed tutorials to localStorage
    localStorage.setItem('completed-tutorials', JSON.stringify([...completedTutorials]))
  }, [completedTutorials])

  const startTutorial = (tutorial: Tutorial) => {
    setActiveTutorial(tutorial)
    setCurrentStep(0)
    setIsPlaying(true)
  }

  const stopTutorial = () => {
    setActiveTutorial(null)
    setCurrentStep(0)
    setIsPlaying(false)
    // Remove highlights
    document.querySelectorAll('[data-tutorial-highlight]').forEach(el => {
      el.removeAttribute('data-tutorial-highlight')
    })
  }

  const nextStep = () => {
    if (activeTutorial && currentStep < activeTutorial.steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeTutorial()
    }
  }

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const completeTutorial = () => {
    if (activeTutorial) {
      setCompletedTutorials(prev => new Set([...prev, activeTutorial.id]))
    }
    stopTutorial()
  }

  const restartTutorial = () => {
    setCurrentStep(0)
    setIsPlaying(true)
  }

  // Highlight current step target
  useEffect(() => {
    if (activeTutorial && isPlaying) {
      const currentStepData = activeTutorial.steps[currentStep]
      
      // Remove previous highlights
      document.querySelectorAll('[data-tutorial-highlight]').forEach(el => {
        el.removeAttribute('data-tutorial-highlight')
      })
      
      // Add current highlight
      if (currentStepData.target && currentStepData.highlight) {
        const target = document.querySelector(currentStepData.target)
        if (target) {
          target.setAttribute('data-tutorial-highlight', 'true')
          target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    }
  }, [activeTutorial, currentStep, isPlaying])

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '初级'
      case 'intermediate': return '中级'
      case 'advanced': return '高级'
      default: return '未知'
    }
  }

  if (!showTutorials && !activeTutorial) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowTutorials(true)}
        className="fixed bottom-28 right-4 z-30 bg-white shadow-lg border"
      >
        <Play className="h-4 w-4 mr-2" />
        教程
      </Button>
    )
  }

  return (
    <>
      {/* Tutorial selection */}
      {showTutorials && !activeTutorial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-2xl max-h-[80vh] overflow-hidden"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>功能教程</CardTitle>
                    <CardDescription>选择一个教程来学习WiFi管理器的功能</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowTutorials(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                {tutorials.map((tutorial) => (
                  <Card 
                    key={tutorial.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${
                      completedTutorials.has(tutorial.id) ? 'bg-green-50 border-green-200' : ''
                    }`}
                    onClick={() => startTutorial(tutorial)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {tutorial.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-medium">{tutorial.title}</h3>
                              {completedTutorials.has(tutorial.id) && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{tutorial.description}</p>
                            <div className="flex items-center space-x-2">
                              <Badge className={getDifficultyColor(tutorial.difficulty)}>
                                {getDifficultyLabel(tutorial.difficulty)}
                              </Badge>
                              <Badge variant="outline">
                                {tutorial.estimatedTime} 分钟
                              </Badge>
                              <Badge variant="outline">
                                {tutorial.steps.length} 步骤
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Active tutorial overlay */}
      {activeTutorial && (
        <div className="fixed inset-0 bg-black/50 z-50">
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-full max-w-md px-4">
            <Card className="bg-white shadow-xl border-2 border-blue-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{activeTutorial.title}</CardTitle>
                    <div className="flex items-center space-x-2 mt-1">
                      <Progress 
                        value={((currentStep + 1) / activeTutorial.steps.length) * 100} 
                        className="flex-1 h-2"
                      />
                      <span className="text-sm text-gray-500">
                        {currentStep + 1}/{activeTutorial.steps.length}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={stopTutorial}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="mb-4">
                  <h3 className="font-medium mb-2">
                    {activeTutorial.steps[currentStep].title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {activeTutorial.steps[currentStep].description}
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={previousStep}
                      disabled={currentStep === 0}
                    >
                      <ArrowLeft className="h-3 w-3 mr-1" />
                      上一步
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={restartTutorial}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      重新开始
                    </Button>
                  </div>
                  
                  <Button size="sm" onClick={nextStep}>
                    {currentStep === activeTutorial.steps.length - 1 ? '完成' : '下一步'}
                    {currentStep < activeTutorial.steps.length - 1 && (
                      <ArrowRight className="h-3 w-3 ml-1" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tutorial highlight styles */}
      <style jsx global>{`
        [data-tutorial-highlight="true"] {
          position: relative;
          z-index: 1001;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
          border-radius: 4px;
          animation: tutorial-pulse 2s infinite;
        }
        
        @keyframes tutorial-pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3);
          }
        }
      `}</style>
    </>
  )
}
