"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  HelpCircle,
  X,
  Search,
  BookOpen,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Shield
} from "lucide-react"
import { Input } from "@/components/ui/input"

interface HelpTopic {
  id: string
  title: string
  description: string
  category: string
  content: React.ReactNode
  keywords: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

// interface ContextualHelp {
//   component: string
//   tips: string[]
//   relatedTopics: string[]
// }

export function HelpSystem() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("topics")

  const helpTopics: HelpTopic[] = [
    {
      id: 'getting-started',
      title: '快速开始',
      description: '了解如何使用WiFi管理器的基本功能',
      category: 'basics',
      keywords: ['开始', '基础', '入门', '新手'],
      difficulty: 'beginner',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">欢迎使用WiFi管理器</h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-blue-600">1</span>
              </div>
              <div>
                <p className="font-medium">扫描网络</p>
                <p className="text-sm text-gray-600">点击&ldquo;扫描&rdquo;按钮查找附近的WiFi网络</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-blue-600">2</span>
              </div>
              <div>
                <p className="font-medium">连接网络</p>
                <p className="text-sm text-gray-600">选择网络并输入密码进行连接</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-blue-600">3</span>
              </div>
              <div>
                <p className="font-medium">管理网络</p>
                <p className="text-sm text-gray-600">保存常用网络，设置自动连接</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'connection-issues',
      title: '连接问题排查',
      description: '解决常见的WiFi连接问题',
      category: 'troubleshooting',
      keywords: ['连接', '问题', '故障', '排查', '修复'],
      difficulty: 'intermediate',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">常见连接问题</h3>
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <h4 className="font-medium text-red-600">无法连接到网络</h4>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li>• 检查密码是否正确</li>
                <li>• 确认网络信号强度足够</li>
                <li>• 尝试重启WiFi适配器</li>
                <li>• 检查网络是否支持您的设备</li>
              </ul>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-medium text-yellow-600">连接不稳定</h4>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                <li>• 检查信号强度和干扰</li>
                <li>• 尝试更换网络频段（2.4G/5G）</li>
                <li>• 重置网络设置</li>
                <li>• 联系网络管理员</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'security-best-practices',
      title: '安全最佳实践',
      description: '保护您的WiFi连接安全',
      category: 'security',
      keywords: ['安全', '密码', '加密', '保护'],
      difficulty: 'intermediate',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">WiFi安全指南</h3>
          <div className="space-y-3">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-800 flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                推荐做法
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-green-700">
                <li>• 优先连接WPA3加密的网络</li>
                <li>• 避免连接开放的公共WiFi</li>
                <li>• 定期更新设备和应用</li>
                <li>• 使用强密码保护网络</li>
              </ul>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-medium text-red-800 flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                安全警告
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-red-700">
                <li>• 不要在公共WiFi上进行敏感操作</li>
                <li>• 警惕伪造的WiFi热点</li>
                <li>• 不要保存不信任网络的密码</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'advanced-settings',
      title: '高级设置',
      description: '配置高级网络选项和自动化功能',
      category: 'advanced',
      keywords: ['高级', '设置', '配置', '自动化'],
      difficulty: 'advanced',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">高级功能配置</h3>
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <h4 className="font-medium">网络优先级</h4>
              <p className="text-sm text-gray-600 mt-1">
                设置网络连接的优先级，系统会自动选择优先级最高的可用网络。
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-medium">自动重连</h4>
              <p className="text-sm text-gray-600 mt-1">
                配置断线重连策略，包括重试次数、间隔时间等参数。
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-medium">网络配置文件</h4>
              <p className="text-sm text-gray-600 mt-1">
                导入/导出网络配置，在多设备间同步网络设置。
              </p>
            </div>
          </div>
        </div>
      )
    }
  ]



  const filteredTopics = helpTopics.filter(topic => 
    searchQuery === "" || 
    topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.keywords.some(keyword => keyword.toLowerCase().includes(searchQuery.toLowerCase()))
  )

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

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 bg-white shadow-lg border"
      >
        <HelpCircle className="h-4 w-4 mr-2" />
        帮助
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden"
      >
        <Card className="h-full flex flex-col">
          <CardHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <BookOpen className="h-5 w-5 mr-2" />
                  帮助中心
                </CardTitle>
                <CardDescription>查找答案和学习如何使用WiFi管理器</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="topics">帮助主题</TabsTrigger>
                <TabsTrigger value="search">搜索</TabsTrigger>
                <TabsTrigger value="contact">联系支持</TabsTrigger>
              </TabsList>
              
              <div className="flex-1 overflow-hidden mt-4">
                <TabsContent value="topics" className="h-full overflow-y-auto">
                  {selectedTopic ? (
                    <div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedTopic(null)}
                        className="mb-4"
                      >
                        ← 返回主题列表
                      </Button>
                      {helpTopics.find(t => t.id === selectedTopic)?.content}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredTopics.map((topic) => (
                        <Card 
                          key={topic.id} 
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setSelectedTopic(topic.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <h3 className="font-medium">{topic.title}</h3>
                                  <Badge className={getDifficultyColor(topic.difficulty)}>
                                    {getDifficultyLabel(topic.difficulty)}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600">{topic.description}</p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="search" className="h-full">
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="搜索帮助主题..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {filteredTopics.map((topic) => (
                        <Card 
                          key={topic.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => {
                            setSelectedTopic(topic.id)
                            setActiveTab('topics')
                          }}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-sm">{topic.title}</h4>
                                <p className="text-xs text-gray-600">{topic.description}</p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="contact" className="h-full">
                  <div className="space-y-4">
                    <div className="text-center">
                      <MessageCircle className="h-12 w-12 mx-auto text-blue-500 mb-4" />
                      <h3 className="text-lg font-semibold mb-2">需要更多帮助？</h3>
                      <p className="text-gray-600 mb-6">我们的支持团队随时为您提供帮助</p>
                    </div>
                    
                    <div className="space-y-3">
                      <Card className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <MessageCircle className="h-5 w-5 text-blue-500" />
                            <div>
                              <p className="font-medium">在线客服</p>
                              <p className="text-sm text-gray-600">实时聊天支持</p>
                            </div>
                            <ExternalLink className="h-4 w-4 text-gray-400 ml-auto" />
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <BookOpen className="h-5 w-5 text-green-500" />
                            <div>
                              <p className="font-medium">用户手册</p>
                              <p className="text-sm text-gray-600">详细的使用指南</p>
                            </div>
                            <ExternalLink className="h-4 w-4 text-gray-400 ml-auto" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
