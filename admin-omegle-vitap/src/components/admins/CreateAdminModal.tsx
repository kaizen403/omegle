import { useState } from "react";
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
import { Check, Loader2 } from "lucide-react";
import { AdminService } from "@/lib/services/adminService";
import { validateEmail, validatePassword } from "@/lib/validators";
import { CreateAdminData } from "@/types/admin";

interface CreateAdminModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  token: string | null;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
}

export function CreateAdminModal({
  open,
  onClose,
  onSuccess,
  token,
  setError,
  setSuccess,
}: CreateAdminModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"super-admin" | "admin">("admin");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setRole("admin");
    setCreated(false);
  };

  const handleCreate = async () => {
    if (!email) {
      setError("Please enter an email address first");
      return;
    }

    if (!validateEmail(email).valid) {
      setError("Please enter a valid email address");
      return;
    }

    if (!password) {
      setError("Please enter a password first");
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error || "Invalid password");
      return;
    }

    if (!name) {
      setError("Please enter a name first");
      return;
    }

    if (!token) {
      setError("Authentication required");
      return;
    }

    try {
      setCreating(true);
      setError("");

      const adminData: CreateAdminData = {
        email,
        password,
        name,
        role,
      };

      await AdminService.createAdmin(adminData);

      setCreated(true);
      setSuccess(
        `Admin created for ${email}. They can sign in with this password, then set up TOTP.`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create admin");
    } finally {
      setCreating(false);
    }
  };

  const handleDone = () => {
    if (!created) {
      setError("Create the admin first");
      return;
    }

    resetForm();
    onClose();
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Admin</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setCreated(false);
              }}
              placeholder="admin@example.com"
              disabled={created}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setCreated(false);
              }}
              placeholder="Enter password (min 8 characters)"
              minLength={8}
              disabled={created}
            />
            <p className="text-xs text-gray-500">
              Minimum 8 characters. Share this password with the new admin.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setCreated(false);
              }}
              placeholder="Admin name"
              disabled={created}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => {
                setRole(value as "super-admin" | "admin");
                setCreated(false);
              }}
              disabled={created}
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

          <div className="pt-2">
            <Button
              type="button"
              variant={created ? "outline" : "default"}
              className={`w-full ${created ? "bg-green-50 border-green-500 text-green-700 hover:bg-green-100" : ""}`}
              onClick={handleCreate}
              disabled={creating || created}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : created ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Admin created
                </>
              ) : (
                "Create admin"
              )}
            </Button>
            {created && (
              <p className="text-xs text-green-600 mt-2 text-center">
                They must enroll an authenticator app on first login.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={handleDone} disabled={!created}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
