"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { HelpCircle, X, Lightbulb, AlertTriangle, Info } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ContextualHelpProps {
  content: string | React.ReactNode
  title?: string
  type?: 'info' | 'tip' | 'warning'
  position?: 'top' | 'bottom' | 'left' | 'right'
  trigger?: 'hover' | 'click'
  children: React.ReactNode
  className?: string
}

export function ContextualHelp({
  content,
  title,
  type = 'info',
  position = 'top',
  trigger = 'hover',
  children,
  className = ""
}: ContextualHelpProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [actualPosition, setActualPosition] = useState(position)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const getIcon = () => {
    switch (type) {
      case 'tip':
        return <Lightbulb className="h-4 w-4 text-yellow-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getTypeStyles = () => {
    switch (type) {
      case 'tip':
        return 'border-yellow-200 bg-yellow-50'
      case 'warning':
        return 'border-orange-200 bg-orange-50'
      default:
        return 'border-blue-200 bg-blue-50'
    }
  }

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    }

    let newPosition = position

    // Check if tooltip would go outside viewport and adjust
    switch (position) {
      case 'top':
        if (triggerRect.top - tooltipRect.height < 10) {
          newPosition = 'bottom'
        }
        break
      case 'bottom':
        if (triggerRect.bottom + tooltipRect.height > viewport.height - 10) {
          newPosition = 'top'
        }
        break
      case 'left':
        if (triggerRect.left - tooltipRect.width < 10) {
          newPosition = 'right'
        }
        break
      case 'right':
        if (triggerRect.right + tooltipRect.width > viewport.width - 10) {
          newPosition = 'left'
        }
        break
    }

    setActualPosition(newPosition)
  }, [position])

  useEffect(() => {
    if (isVisible) {
      calculatePosition()
    }
  }, [isVisible, calculatePosition])

  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      setIsVisible(true)
    }
  }

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      setIsVisible(false)
    }
  }

  const handleClick = () => {
    if (trigger === 'click') {
      setIsVisible(!isVisible)
    }
  }

  const getPositionStyles = () => {
    switch (actualPosition) {
      case 'top':
        return {
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px'
        }
      case 'bottom':
        return {
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px'
        }
      case 'left':
        return {
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginRight: '8px'
        }
      case 'right':
        return {
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: '8px'
        }
      default:
        return {}
    }
  }

  const getArrowStyles = () => {
    const arrowSize = 6
    switch (actualPosition) {
      case 'top':
        return {
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
          borderTop: `${arrowSize}px solid white`,
          borderBottom: 'none'
        }
      case 'bottom':
        return {
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid white`,
          borderTop: 'none'
        }
      case 'left':
        return {
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          borderTop: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid transparent`,
          borderLeft: `${arrowSize}px solid white`,
          borderRight: 'none'
        }
      case 'right':
        return {
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          borderTop: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid white`,
          borderLeft: 'none'
        }
      default:
        return {}
    }
  }

  return (
    <div 
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      
      <AnimatePresence>
        {isVisible && (
          <div
            ref={tooltipRef}
            className="absolute z-50"
            style={getPositionStyles()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
            >
              <Card className={`shadow-lg border-2 ${getTypeStyles()} max-w-xs`}>
                <CardContent className="p-3">
                  <div className="flex items-start space-x-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                      {title && (
                        <h4 className="font-medium text-sm mb-1 text-gray-900">
                          {title}
                        </h4>
                      )}
                      <div className="text-sm text-gray-700">
                        {typeof content === 'string' ? (
                          <p>{content}</p>
                        ) : (
                          content
                        )}
                      </div>
                    </div>
                    {trigger === 'click' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsVisible(false)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Arrow */}
              <div
                className="absolute w-0 h-0"
                style={getArrowStyles()}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Quick help trigger component
export function QuickHelp({ 
  content, 
  title, 
  type = 'info',
  size = 'sm' 
}: {
  content: string | React.ReactNode
  title?: string
  type?: 'info' | 'tip' | 'warning'
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  return (
    <ContextualHelp
      content={content}
      title={title}
      type={type}
      trigger="hover"
      position="top"
    >
      <HelpCircle className={`${sizeClasses[size]} text-gray-400 hover:text-gray-600 cursor-help`} />
    </ContextualHelp>
  )
}

// Feature tour component for guided walkthroughs
export function FeatureTour({
  steps,
  isActive,
  onComplete,
  onSkip
}: {
  steps: Array<{
    target: string
    title: string
    content: string
    position?: 'top' | 'bottom' | 'left' | 'right'
  }>
  isActive: boolean
  onComplete: () => void
  onSkip: () => void
}) {
  const [currentStep, setCurrentStep] = useState(0)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (isActive && steps[currentStep]) {
      const element = document.querySelector(steps[currentStep].target) as HTMLElement
      setTargetElement(element)
      
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Add highlight effect
        element.style.position = 'relative'
        element.style.zIndex = '1000'
        element.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5)'
        element.style.borderRadius = '4px'
      }
    }

    return () => {
      if (targetElement) {
        targetElement.style.position = ''
        targetElement.style.zIndex = ''
        targetElement.style.boxShadow = ''
        targetElement.style.borderRadius = ''
      }
    }
  }, [currentStep, isActive, steps, targetElement])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  if (!isActive || !steps[currentStep] || !targetElement) {
    return null
  }

  const step = steps[currentStep]

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" />
      
      {/* Tour tooltip */}
      <div className="fixed z-50" style={{
        top: targetElement.offsetTop + targetElement.offsetHeight + 10,
        left: targetElement.offsetLeft
      }}>
        <Card className="shadow-xl border-2 border-blue-200 bg-white max-w-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-lg">{step.title}</h3>
              <div className="text-sm text-gray-500">
                {currentStep + 1} / {steps.length}
              </div>
            </div>
            
            <p className="text-gray-700 mb-4">{step.content}</p>
            
            <div className="flex justify-between items-center">
              <Button variant="ghost" onClick={onSkip}>
                跳过导览
              </Button>
              
              <div className="space-x-2">
                {currentStep > 0 && (
                  <Button variant="outline" onClick={handlePrevious}>
                    上一步
                  </Button>
                )}
                <Button onClick={handleNext}>
                  {currentStep === steps.length - 1 ? '完成' : '下一步'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
