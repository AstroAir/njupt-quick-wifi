"use client"

import { useState, useEffect } from "react"

/**
 * Custom hook to detect if the current device is mobile
 * Uses window.matchMedia to detect screen size changes
 * Returns true for screens smaller than 768px (mobile/tablet)
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === "undefined") return

    const mobileQuery = window.matchMedia("(max-width: 767px)")
    
    // Set initial value
    setIsMobile(mobileQuery.matches)

    // Create event listener function
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }

    // Add event listener
    mobileQuery.addEventListener("change", handleChange)

    // Cleanup function
    return () => {
      mobileQuery.removeEventListener("change", handleChange)
    }
  }, [])

  return isMobile
}
