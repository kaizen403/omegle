"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
import { Card, CardContent } from "@/components/ui/card";
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
        <PageHeader title="Admin Management" />
        <div className="p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-gray-500">
                You don&apos;t have permission to access this page. Only super
                admins can manage other administrators.
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout onLogout={logout}>
      <PageHeader title="Admin Management" />

      <div className="p-4 sm:p-6">
        {/* Success/Error Messages */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-lg text-emerald-300"
          >
            {success}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300"
          >
            {error}
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="mb-6 flex gap-3">
          <Button
            onClick={handleOpenCreateModal}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Admin
          </Button>
          <Button
            variant="outline"
            onClick={fetchSessions}
            disabled={sessionsLoading}
            className="border-sky-200 text-slate-600 hover:bg-sky-50"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${sessionsLoading ? "animate-spin" : ""}`}
            />
            Refresh Sessions
          </Button>
        </div>

        {/* Active Sessions */}
        <AdminSessions
          sessions={sessions}
          loading={sessionsLoading}
          onRevokeSession={handleRevokeClick}
        />

        {/* Admins List */}
        <AdminList
          admins={admins}
          sessions={sessions}
          loading={loading}
          onEdit={handleOpenEditModal}
          onDelete={handleDeleteClick}
          onRevokeSession={handleRevokeClick}
        />
      </div>

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
            <AlertDialogTitle>Delete Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this admin? This action cannot be
              undone. The admin will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Session Confirmation Dialog */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Sessions</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Are you sure you want to revoke all active sessions for{" "}
                <strong className="text-slate-900">
                  {pendingRevokeAdmin?.name}
                </strong>
                ?
              </span>
              <span className="block mt-2">They will be:</span>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Immediately disconnected</li>
                <li>Logged out from all devices</li>
                <li>Shown a notification explaining the revocation</li>
              </ul>
              <span className="block mt-2 text-orange-400">
                This action cannot be undone.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRevokeAdmin(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevoke}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Revoke Sessions
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
