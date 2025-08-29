import { WifiManager } from "@/components/wifi-manager";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

export default function Home() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="wifi-manager-theme">
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Responsive container with mobile-first padding */}
        <div className="responsive-container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {/* Responsive header */}
          <header className="mb-6 sm:mb-8 lg:mb-10">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white leading-tight">
              WiFi Connection Manager
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl">
              Manage your WiFi connections with smart features and network optimization for NJUPT campus.
            </p>
          </header>

          {/* Main content area with responsive layout */}
          <div className="w-full">
            <WifiManager />
          </div>

          {/* Toast notifications */}
          <Toaster />
        </div>
      </main>
    </ThemeProvider>
  );
}
