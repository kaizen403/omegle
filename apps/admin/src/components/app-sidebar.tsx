"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Users,
  History,
  MessagesSquare,
  Activity,
  Archive,
  LogOut,
  ChevronsUpDown,
  UserCog,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthProvider";

type Role = "admin" | "super-admin";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
}

/**
 * Navigation, grouped by what an admin is actually doing.
 *
 * Two corrections to the old list: "Logs" pointed at /home/logs, which has no
 * page and 404'd, and the Archives page existed with no way to reach it.
 */
const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Live",
    items: [
      { title: "Dashboard", url: "/home", icon: LayoutDashboard },
      { title: "Users", url: "/home/users", icon: Users },
      { title: "Rooms", url: "/home/rooms", icon: MessagesSquare },
    ],
  },
  {
    label: "Review",
    items: [
      { title: "Moderation", url: "/home/moderation", icon: ShieldAlert },
      { title: "Archives", url: "/home/archives", icon: Archive },
      { title: "User history", url: "/home/user-history", icon: History },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Health", url: "/home/health", icon: Activity },
      { title: "Bots", url: "/home/bots", icon: Bot, roles: ["super-admin"] },
      {
        title: "Admins",
        url: "/home/admins",
        icon: UserCog,
        roles: ["super-admin"],
      },
    ],
  },
];

interface AppSidebarProps {
  onLogout: () => void;
}

export function AppSidebar({ onLogout }: AppSidebarProps) {
  const pathname = usePathname();
  const { admin } = useAuth();
  const role = admin?.role ?? "";

  // /home must match exactly or it stays highlighted on every child route.
  const isActive = (url: string) =>
    url === "/home" ? pathname === "/home" : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* Wordmark only — no icon tile. The whole header is hidden when the
          sidebar collapses to the icon rail, since there is no glyph left to
          stand in for it at 3rem wide. */}
      <SidebarHeader className="border-b border-sidebar-border group-data-[collapsible=icon]:hidden">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/home">
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold text-foreground">
                    Omegle
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Admin console
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(
            (item) => !item.roles || item.roles.includes(role as Role),
          );
          if (items.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                      >
                        <Link href={item.url}>
                          <item.icon className="size-4" />
                          <span className="truncate">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium text-foreground">
                      {admin?.name || "Admin"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {admin?.role === "super-admin" ? "Super admin" : "Admin"}
                    </span>
                  </span>
                  <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block truncate text-sm font-medium">
                    {admin?.name || "Admin"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {admin?.email || "—"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-danger focus:text-danger"
                  onClick={onLogout}
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
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
