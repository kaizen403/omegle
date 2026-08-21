import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

  // Reset form when admin prop changes
  // This is necessary because the modal needs to sync with the selected admin

  useEffect(() => {
    if (admin) {
      setName(admin.name);
      setRole(admin.role);
      setIsActive(admin.isActive);
    }
  }, [admin]);

  const handleSubmit = async () => {
    if (!token || !admin) return;

    setError("");
    setSuccess("");

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
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while updating admin",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Admin</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) =>
                setRole(value as "super-admin" | "admin")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super-admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-status">Status</Label>
            <Select
              value={isActive ? "active" : "inactive"}
              onValueChange={(value) => setIsActive(value === "active")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Update</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
