'use client'

import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { SidebarContent } from './sidebar'
import type { AuthUser } from '@/lib/auth'

export function MobileSidebar({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <>
      <button 
        onClick={() => setOpen(true)}
        className="md:hidden p-4 fixed top-0 left-0 z-40 text-text-primary"
      >
        <Menu className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/50 z-50 md:hidden backdrop-blur-sm"
            />
            
            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-64 md:hidden"
            >
               <SidebarContent user={user} />
               <button 
                 onClick={() => setOpen(false)}
                 className="absolute top-4 right-4 p-2 text-text-muted hover:text-text-primary"
               >
                 <X className="w-5 h-5" />
               </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
