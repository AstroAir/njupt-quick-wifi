"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { 
  Menu, 
  X, 
  Wifi, 
  Bookmark, 
  Zap, 
  Settings as SettingsIcon 
} from "lucide-react"

interface MobileMenuProps {
  activeTab: string
  onTabChange: (tab: string) => void
  className?: string
}

interface MenuItem {
  id: string
  label: string
  shortLabel: string
  icon: React.ReactNode
}

const menuItems: MenuItem[] = [
  {
    id: "available",
    label: "可用网络",
    shortLabel: "可用",
    icon: <Wifi className="h-4 w-4" />
  },
  {
    id: "saved", 
    label: "已保存网络",
    shortLabel: "已保存",
    icon: <Bookmark className="h-4 w-4" />
  },
  {
    id: "smart",
    label: "智能连接", 
    shortLabel: "智能",
    icon: <Zap className="h-4 w-4" />
  },
  {
    id: "settings",
    label: "设置",
    shortLabel: "设置", 
    icon: <SettingsIcon className="h-4 w-4" />
  }
]

export function MobileMenu({ activeTab, onTabChange, className }: MobileMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)

  const handleTabSelect = (tabId: string) => {
    onTabChange(tabId)
    setIsOpen(false)
  }

  const activeItem = menuItems.find(item => item.id === activeTab)

  return (
    <div className={cn("relative", className)}>
      {/* Mobile menu trigger button */}
      <Button
        variant="outline"
        size="sm"
        onClick={toggleMenu}
        className="flex items-center gap-2 min-h-[44px] w-full justify-between"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="打开导航菜单"
      >
        <div className="flex items-center gap-2">
          {activeItem?.icon}
          <span className="text-sm font-medium">{activeItem?.label}</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </motion.div>
      </Button>

      {/* Mobile menu dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu content */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
            >
              <div className="py-2">
                {menuItems.map((item, index) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.2 }}
                    onClick={() => handleTabSelect(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors min-h-[44px]",
                      "hover:bg-gray-100 dark:hover:bg-gray-700",
                      "focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none",
                      activeTab === item.id && "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    )}
                    role="menuitem"
                  >
                    <div className={cn(
                      "flex-shrink-0",
                      activeTab === item.id ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                    )}>
                      {item.icon}
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                    {activeTab === item.id && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="ml-auto w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
