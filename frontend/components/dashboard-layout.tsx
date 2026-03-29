"use client"

import { Toaster } from "sonner"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { FarmScopeProvider } from "@/components/farm-scope-context"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <FarmScopeProvider>
        <AppSidebar />
        <div className="pl-52">
          <AppHeader />
          <main className="p-6">{children}</main>
        </div>
        <Toaster richColors position="top-center" />
      </FarmScopeProvider>
    </div>
  )
}
