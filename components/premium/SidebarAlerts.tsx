'use client'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { AlertsManager } from './AlertsManager'

export function SidebarAlerts() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="relative gap-2 border border-blue-200 bg-white text-blue-900 hover:bg-blue-50">
          <Bell className="h-4 w-4 text-blue-600" />
          <span className="hidden md:inline">Meus Alertas</span>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500"></span>
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Configurações de Alerta
          </SheetTitle>
        </SheetHeader>
        <div className="py-4">
          <AlertsManager />
        </div>
        <div className="mt-8 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <h4 className="mb-1 text-sm font-semibold text-slate-700">Dica Premium</h4>
          <p className="text-xs text-slate-500">
            Nossos robôs consultam o PNCP às 07:00 horas e às 16:00 horas. Se houver uma nova dispensa ou pregão, você será o primeiro a saber.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
