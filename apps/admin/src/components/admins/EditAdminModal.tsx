"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminService } from "@/lib/services/adminService";
import { Admin, UpdateAdminData } from "@/types/admin";

interface EditAdminModalProps {
  open: boolean;
  admin: Admin | null;
  onClose: () => void;
  onSuccess: () => void;
  token: string | null;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
}

export function EditAdminModal({
  open,
  admin,
  onClose,
  onSuccess,
  token,
  setError,
  setSuccess,
}: EditAdminModalProps) {
  const [name, setName] = useState(admin?.name || "");
  const [role, setRole] = useState<"super-admin" | "admin">(
    admin?.role || "admin",
  );
  const [isActive, setIsActive] = useState(admin?.isActive ?? true);
  // Mirrors the page-level banner so the failure is visible inside the dialog.
  const [formError, setFormError] = useState("");

  // Reset form when admin prop changes
  // This is necessary because the modal needs to sync with the selected admin

  useEffect(() => {
    if (admin) {
      setName(admin.name);
      setRole(admin.role);
      setIsActive(admin.isActive);
      setFormError("");
    }
  }, [admin]);

  const handleSubmit = async () => {
    if (!token || !admin) return;

    setError("");
    setSuccess("");
    setFormError("");

    try {
      const updateData: UpdateAdminData = {
        name,
        role,
        isActive,
      };

      await AdminService.updateAdmin(admin.id, updateData);

      setSuccess("Admin updated successfully");
      onClose();
      onSuccess();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An error occurred while updating admin";
      setFormError(message);
      setError(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-base font-semibold">
            Edit admin
          </DialogTitle>
          <DialogDescription className="truncate text-sm text-muted-foreground">
            {admin ? admin.email : "Update this admin's details and access."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              className="h-9"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) =>
                setRole(value as "super-admin" | "admin")
              }
            >
              <SelectTrigger id="edit-role" className="h-9 w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super-admin">Super admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-status">Status</Label>
            <Select
              value={isActive ? "active" : "inactive"}
              onValueChange={(value) => setIsActive(value === "active")}
            >
              <SelectTrigger id="edit-status" className="h-9 w-full">
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Inactive admins keep their account but cannot sign in.
            </p>
          </div>

          {formError && (
            <p
              role="alert"
              className="min-w-0 rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger"
            >
              {formError}
            </p>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" className="h-9" onClick={onClose}>
            Cancel
          </Button>
          <Button className="h-9" onClick={handleSubmit}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
