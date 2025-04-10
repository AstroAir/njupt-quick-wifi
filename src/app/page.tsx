import { WifiManager } from "@/components/wifi-manager";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

export default function Home() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="wifi-manager-theme">
      <main className="min-h-screen p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 dark:text-white">
            WiFi Connection Manager
          </h1>
          <WifiManager />
          <Toaster />
        </div>
      </main>
    </ThemeProvider>
  );
}
