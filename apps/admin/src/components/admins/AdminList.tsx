"use client";

import { Pencil, Power, Trash2 } from "lucide-react";
import { Admin, AdminSession } from "@/types/admin";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  Section,
  StatusPill,
  TableShell,
  TableSkeleton,
  Td,
  Th,
  Tr,
} from "@/components/console";

interface AdminListProps {
  admins: Admin[];
  sessions: AdminSession[];
  loading: boolean;
  onEdit: (admin: Admin) => void;
  onDelete: (adminId: string) => void;
  onRevokeSession: (adminId: string, adminName: string) => void;
}

export function AdminList({
  admins,
  sessions,
  loading,
  onEdit,
  onDelete,
  onRevokeSession,
}: AdminListProps) {
  const sessionCount = (adminId: string) =>
    sessions.filter((session) => session.adminId === adminId).length;

  return (
    <Section
      title="Administrators"
      description={
        loading
          ? "Loading the admin directory."
          : `${admins.length} ${admins.length === 1 ? "account" : "accounts"} with console access.`
      }
      contentClassName="p-0"
    >
      {loading ? (
        <TableShell>
          <thead>
            <tr>
              <Th>Admin</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Sessions</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <TableSkeleton rows={4} cols={5} />
        </TableShell>
      ) : admins.length === 0 ? (
        <EmptyState
          title="No admins yet"
          description="Create an admin account to give someone access to this console."
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Admin</Th>
              <Th className="hidden sm:table-cell">Role</Th>
              <Th className="hidden md:table-cell">Status</Th>
              <Th className="hidden lg:table-cell">Sessions</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => {
              const online = sessionCount(admin.id);
              return (
                <Tr key={admin.id}>
                  <Td>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="min-w-0">
                        <p
                          className="truncate font-medium text-foreground"
                          title={admin.name}
                        >
                          {admin.name}
                        </p>
                        <p
                          className="truncate text-xs text-muted-foreground"
                          title={admin.email}
                        >
                          {admin.email}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
                          <StatusPill
                            tone={
                              admin.role === "super-admin" ? "info" : "neutral"
                            }
                          >
                            {admin.role === "super-admin"
                              ? "Super admin"
                              : "Admin"}
                          </StatusPill>
                          <StatusPill
                            tone={admin.isActive ? "success" : "neutral"}
                            dot
                          >
                            {admin.isActive ? "Active" : "Inactive"}
                          </StatusPill>
                        </div>
                      </div>
                    </div>
                  </Td>

                  <Td className="hidden sm:table-cell">
                    <StatusPill
                      tone={admin.role === "super-admin" ? "info" : "neutral"}
                    >
                      {admin.role === "super-admin" ? "Super admin" : "Admin"}
                    </StatusPill>
                  </Td>

                  <Td className="hidden md:table-cell">
                    <StatusPill
                      tone={admin.isActive ? "success" : "neutral"}
                      dot
                    >
                      {admin.isActive ? "Active" : "Inactive"}
                    </StatusPill>
                  </Td>

                  <Td className="hidden lg:table-cell">
                    {online > 0 ? (
                      <StatusPill tone="success" dot>
                        <span className="tabular-nums">{online}</span> online
                      </StatusPill>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Offline
                      </span>
                    )}
                  </Td>

                  <Td align="right">
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(admin)}
                      >
                        <Pencil className="size-4" strokeWidth={2} />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      {online > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-warning hover:text-warning"
                          onClick={() => onRevokeSession(admin.id, admin.name)}
                        >
                          <Power className="size-4" strokeWidth={2} />
                          <span className="hidden sm:inline">Revoke</span>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger-surface hover:text-danger"
                        onClick={() => onDelete(admin.id)}
                      >
                        <Trash2 className="size-4" strokeWidth={2} />
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
    </Section>
  );
}
