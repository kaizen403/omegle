"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Users,
  History,
  MessageSquare,
  Activity,
  FileText,
  LogOut,
  ChevronUp,
  User2,
  Bot,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthProvider";

// Menu items
const items = [
  {
    title: "Dashboard",
    url: "/home",
    icon: LayoutDashboard,
    roles: ["admin", "super-admin"],
  },
  {
    title: "Users",
    url: "/home/users",
    icon: Users,
    roles: ["admin", "super-admin"],
  },
  {
    title: "User History",
    url: "/home/user-history",
    icon: History,
    roles: ["admin", "super-admin"],
  },
  {
    title: "Rooms",
    url: "/home/rooms",
    icon: MessageSquare,
    roles: ["admin", "super-admin"],
  },
  {
    title: "Moderation",
    url: "/home/moderation",
    icon: ShieldAlert,
    roles: ["admin", "super-admin"],
  },
  {
    title: "Bots",
    url: "/home/bots",
    icon: Bot,
    roles: ["super-admin"], // Only super-admin can access
  },
  {
    title: "Health",
    url: "/home/health",
    icon: Activity,
    roles: ["admin", "super-admin"],
  },
  {
    title: "Logs",
    url: "/home/logs",
    icon: FileText,
    roles: ["admin", "super-admin"],
  },
  {
    title: "Admins",
    url: "/home/admins",
    icon: User2,
    roles: ["super-admin"], // Only super-admin can access
  },
];

interface AppSidebarProps {
  onLogout: () => void;
}

export function AppSidebar({ onLogout }: AppSidebarProps) {
  const pathname = usePathname();
  const { admin } = useAuth();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="flex items-center gap-2">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <LayoutDashboard className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Admin Portal</span>
                  <span className="truncate text-xs">Omegle</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items
                .filter(
                  (item) =>
                    !item.roles || item.roles.includes(admin?.role || ""),
                )
                .map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname === item.url}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-[#0084d1] text-white font-semibold text-sm">
                    {admin?.email?.charAt(0).toUpperCase() || "A"}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {admin?.name || "Admin"}
                    </span>
                    <span className="truncate text-xs">
                      {admin?.email || "admin@example.com"}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-56">
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600 cursor-pointer"
                  onClick={onLogout}
                >
                  <LogOut className="mr-2 size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
