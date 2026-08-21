"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthProvider";

interface NavItemProps {
  href: string;
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
}

function NavItem({
  href,
  label,
  isActive,
  isCollapsed,
  onClick,
}: NavItemProps & { onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
        isActive
          ? "bg-zinc-800 text-white"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-white",
        isCollapsed && "justify-center",
      )}
    >
      <span className={cn("font-medium", isCollapsed && "text-lg")}>
        {label.charAt(0)}
      </span>
      {!isCollapsed && <span className="font-medium">{label}</span>}
    </Link>
  );
}

interface SidebarProps {
  onLogout: () => void;
}

export default function Sidebar({ onLogout }: SidebarProps) {
  const pathname = usePathname();
  const { admin } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebarCollapsed") === "true";
    }
    return false;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebarCollapsed", String(newState));
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-5 left-4 z-50 lg:hidden bg-zinc-800 border border-zinc-700 rounded-lg p-2.5 hover:bg-zinc-700 transition-colors"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        )}
      </button>

      <div
        className={cn(
          "bg-zinc-950 border-r border-zinc-800 flex flex-col relative transition-all duration-300",
          "fixed lg:static inset-y-0 left-0 z-40",
          isCollapsed ? "w-20" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          {!isCollapsed ? (
            <>
              <div>
                <h1 className="text-xl font-bold">Admin Portal</h1>
                <p className="text-xs text-zinc-500 mt-1">Omegle</p>
              </div>
              <button
                onClick={handleToggle}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                title="Collapse sidebar"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={handleToggle}
              className="mx-auto p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Expand sidebar"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem
            href="/home"
            label="Dashboard"
            isActive={pathname === "/home"}
            isCollapsed={isCollapsed}
            onClick={() => setIsMobileOpen(false)}
          />
          <NavItem
            href="/home/users"
            label="Users"
            isActive={pathname === "/home/users"}
            isCollapsed={isCollapsed}
            onClick={() => setIsMobileOpen(false)}
          />
          <NavItem
            href="/home/user-history"
            label="User History"
            isActive={pathname === "/home/user-history"}
            isCollapsed={isCollapsed}
            onClick={() => setIsMobileOpen(false)}
          />
          <NavItem
            href="/home/rooms"
            label="Rooms"
            isActive={pathname === "/home/rooms"}
            isCollapsed={isCollapsed}
            onClick={() => setIsMobileOpen(false)}
          />
          <NavItem
            href="/home/health"
            label="Health"
            isActive={pathname === "/home/health"}
            isCollapsed={isCollapsed}
            onClick={() => setIsMobileOpen(false)}
          />
          <NavItem
            href="/home/logs"
            label="Logs"
            isActive={pathname === "/home/logs"}
            isCollapsed={isCollapsed}
            onClick={() => setIsMobileOpen(false)}
          />
        </nav>

        {/* Footer - Admin Profile */}
        <div className="p-4 border-t border-zinc-800 relative">
          <button
            onClick={() => setShowLogoutPopup(!showLogoutPopup)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors",
              isCollapsed && "justify-center",
            )}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {admin?.email?.charAt(0).toUpperCase() || "A"}
            </div>
            {!isCollapsed && (
              <div className="flex-1 text-left min-w-0">
                <div className="font-medium text-white text-sm truncate">
                  {admin?.name || "Admin"}
                </div>
                <div className="text-xs text-zinc-500 truncate">
                  {admin?.email || "admin@example.com"}
                </div>
              </div>
            )}
          </button>

          {/* Logout Popup */}
          {showLogoutPopup && (
            <div
              className={cn(
                "absolute bottom-full mb-2 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden",
                isCollapsed ? "left-4 w-48" : "left-4 right-4",
              )}
            >
              <button
                onClick={() => {
                  setShowLogoutPopup(false);
                  setIsMobileOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-zinc-900 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="font-medium">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
