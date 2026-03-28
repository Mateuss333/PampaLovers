"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Map,
  Satellite,
  BarChart3,
  Settings,
  Leaf,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Mis Lotes", href: "/lotes", icon: Map },
  { name: "Vista Satelital", href: "/satelite", icon: Satellite },
  { name: "Rendimientos", href: "/analytics", icon: BarChart3 },
  { name: "Configuración", href: "/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-52 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary">
          <Leaf className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <span className="text-lg font-semibold tracking-tight">AgroSmart</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-sidebar-primary")} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* ML Status Footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-md bg-sidebar-accent/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-sidebar-foreground/60">
            ML Model Status
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sidebar-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sidebar-primary" />
            </div>
            <span className="text-sm font-medium text-sidebar-primary">Activo</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
