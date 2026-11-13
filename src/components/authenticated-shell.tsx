'use client'

import React, { useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import type { Profile, Organization } from '@/types/database'

interface AuthenticatedShellProps {
  profile: Profile
  organization: Organization | null
  children: React.ReactNode
}

export function AuthenticatedShell({
  profile,
  organization,
  children,
}: AuthenticatedShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#0e0e10] text-zinc-100 print:bg-white print:text-black print:min-h-0 print:block">
      <AppSidebar
        profile={profile}
        organization={organization}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />
      <div className="lg:pl-64 flex flex-col min-h-screen min-w-0 print:pl-0">
        <AppHeader
          profile={profile}
          organization={organization}
          onOpenMobileSidebar={() => setIsMobileOpen(true)}
        />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 print:p-0 print:m-0 print:max-w-none print:w-full print:block">
          {children}
        </main>
      </div>
    </div>
  )
}

