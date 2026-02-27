"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  StickyNote,
  Bot,
  LogOut,
  Menu,
  X,
  Phone
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const pathname = usePathname();
  const { role, logout } = useRole();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const mainItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/', roles: ['Admin', 'Employee', 'Client', 'Intern'] },
    { name: 'Projects', icon: StickyNote, href: '/projects', roles: ['Admin', 'Employee', 'Intern'] },
    { name: 'Clients', icon: Users, href: '/clients', roles: ['Admin', 'Employee'] },
    { name: 'Email Agent', icon: Bot, href: '/email-agent', roles: ['Admin', 'Employee'] },
    { name: 'Calls', icon: Phone, href: '/calls', roles: ['Admin', 'Employee'] },
  ];

  const moreItems = [
    { name: 'Interns', href: '/interns', roles: ['Admin', 'Employee'] },
    { name: 'Employees', href: '/employees', roles: ['Admin'] },
  ];

  const filteredMainItems = mainItems.filter(item => item.roles.includes(role));
  const filteredMoreItems = moreItems.filter(item => item.roles.includes(role));

  return (
    <>
      {/* Spacer to prevent content from hiding behind the navbar */}
      <div className="h-24 w-full"></div>

      {/* Glassmorphism Bottom Nav */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-2 px-4 py-3 bg-white/70 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] rounded-full">
          {filteredMainItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="relative px-4 py-3 rounded-full flex items-center justify-center transition-colors group"
              >
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 bg-indigo-600 rounded-full shadow-lg"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                {/* Tooltip */}
                <span className="absolute -top-11 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900 text-white text-[13px] font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl">
                  {item.name}
                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                </span>
                <item.icon
                  className={cn(
                    "w-6 h-6 relative z-10 transition-colors duration-300",
                    isActive ? "text-white" : "text-gray-400 group-hover:text-indigo-600"
                  )}
                />
              </Link>
            );
          })}

          <div className="w-px h-8 bg-gray-300/50 mx-2"></div>

          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className="relative px-4 py-3 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-colors"
          >
            {isMoreOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* More Menu Dropup */}
        <AnimatePresence>
          {isMoreOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute bottom-full mb-4 right-0 w-48 bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-2xl p-2 overflow-hidden"
            >
              <div className="p-3 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm">
                  {role.substring(0, 2).toUpperCase()}
                </div>
                <div className="text-sm font-bold text-gray-800">{role}</div>
              </div>
              <div className="py-2">
                {filteredMoreItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className="block px-4 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-white/50 rounded-lg transition-colors font-medium"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
              <div className="p-2 border-t border-gray-100">
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors font-medium"
                >
                  Logout
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
