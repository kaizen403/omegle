"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import { useAdminSocketContext } from "@/contexts/AdminSocketContext";
import { useAdminManagement } from "@/hooks/useAdminManagement";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { AdminSessions } from "@/components/admins/AdminSessions";
import { AdminList } from "@/components/admins/AdminList";
import { CreateAdminModal } from "@/components/admins/CreateAdminModal";
import { EditAdminModal } from "@/components/admins/EditAdminModal";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  PageBody,
  Section,
  Toolbar,
  ToolbarActions,
  ToolbarMain,
} from "@/components/console";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Admin } from "@/types/admin";

export default function AdminsPage() {
  const { token, logout, admin: currentAdmin } = useAuth();
  const { socket } = useAdminSocketContext();
  const isSuperAdmin = currentAdmin?.role === "super-admin";

  const {
    admins,
    sessions,
    loading,
    sessionsLoading,
    error,
    success,
    fetchAdmins,
    fetchSessions,
    revokeSession,
    deleteAdmin,
    setError,
    setSuccess,
  } = useAdminManagement({
    token,
    currentAdminId: currentAdmin?.id,
    isSuperAdmin,
    socket,
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingRevokeAdmin, setPendingRevokeAdmin] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (admin: Admin) => {
    setSelectedAdmin(admin);
    setShowEditModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedAdmin(null);
  };

  // Delete handlers
  const handleDeleteClick = (adminId: string) => {
    setPendingDeleteId(adminId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (pendingDeleteId) {
      await deleteAdmin(pendingDeleteId);
      setPendingDeleteId(null);
    }
    setDeleteDialogOpen(false);
  };

  // Revoke session handlers
  const handleRevokeClick = (adminId: string, adminName: string) => {
    setPendingRevokeAdmin({ id: adminId, name: adminName });
    setRevokeDialogOpen(true);
  };

  const confirmRevoke = async () => {
    if (pendingRevokeAdmin) {
      await revokeSession(pendingRevokeAdmin.id, pendingRevokeAdmin.name);
      setPendingRevokeAdmin(null);
    }
    setRevokeDialogOpen(false);
  };

  if (!isSuperAdmin) {
    return (
      <AdminLayout onLogout={logout}>
        <PageHeader title="Admin management" />
        <PageBody>
          <Section contentClassName="p-0">
            <EmptyState
              title="You cannot manage admins"
              description="Only super admins can create, edit, or remove other administrators."
            />
          </Section>
        </PageBody>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout onLogout={logout}>
      <PageHeader
        title="Admin management"
        description="Accounts and live sessions for this console"
      />

      <PageBody>
        {success && (
          <p
            role="status"
            className="min-w-0 rounded-lg border border-success-line bg-success-surface px-3 py-2.5 text-sm text-success"
          >
            {success}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="min-w-0 rounded-lg border border-danger-line bg-danger-surface px-3 py-2.5 text-sm text-danger"
          >
            {error}
          </p>
        )}

        <Toolbar>
          <ToolbarMain>
            <p className="text-sm text-muted-foreground">
              <span className="tabular-nums">{admins.length}</span>{" "}
              {admins.length === 1 ? "admin" : "admins"} ·{" "}
              <span className="tabular-nums">{sessions.length}</span> active{" "}
              {sessions.length === 1 ? "session" : "sessions"}
            </p>
          </ToolbarMain>
          <ToolbarActions>
            <Button
              variant="outline"
              className="h-9"
              onClick={fetchSessions}
              disabled={sessionsLoading}
            >
              <RefreshCw
                className={`size-4 ${sessionsLoading ? "animate-spin" : ""}`}
                strokeWidth={2}
              />
              Refresh sessions
            </Button>
            <Button className="h-9" onClick={handleOpenCreateModal}>
              <Plus className="size-4" strokeWidth={2} />
              Create admin
            </Button>
          </ToolbarActions>
        </Toolbar>

        <AdminSessions
          sessions={sessions}
          loading={sessionsLoading}
          onRevokeSession={handleRevokeClick}
        />

        <AdminList
          admins={admins}
          sessions={sessions}
          loading={loading}
          onEdit={handleOpenEditModal}
          onDelete={handleDeleteClick}
          onRevokeSession={handleRevokeClick}
        />
      </PageBody>

      {/* Modals */}
      <CreateAdminModal
        open={showCreateModal}
        onClose={handleCloseCreateModal}
        onSuccess={fetchAdmins}
        token={token}
        setError={setError}
        setSuccess={setSuccess}
      />

      <EditAdminModal
        open={showEditModal}
        admin={selectedAdmin}
        onClose={handleCloseEditModal}
        onSuccess={fetchAdmins}
        token={token}
        setError={setError}
        setSuccess={setSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this admin?</AlertDialogTitle>
            <AlertDialogDescription>
              The account is removed permanently and cannot be restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel
              className="h-9"
              onClick={() => setPendingDeleteId(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="h-9 bg-destructive text-white hover:bg-destructive/90"
            >
              Delete admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Session Confirmation Dialog */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke all sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRevokeAdmin?.name ?? "This admin"} is disconnected
              immediately, signed out on every device, and shown a notice
              explaining why. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel
              className="h-9"
              onClick={() => setPendingRevokeAdmin(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevoke}
              className="h-9 bg-destructive text-white hover:bg-destructive/90"
            >
              Revoke sessions
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
