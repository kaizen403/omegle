"use client";

import { useState } from "react";
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
  // Mirrors whatever went to the page-level banner so the message is also
  // visible next to the fields it is about.
  const [formError, setFormError] = useState("");

  const fail = (message: string) => {
    setFormError(message);
    setError(message);
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setRole("admin");
    setCreated(false);
    setFormError("");
  };

  const handleCreate = async () => {
    if (!email) {
      fail("Please enter an email address first");
      return;
    }

    if (!validateEmail(email).valid) {
      fail("Please enter a valid email address");
      return;
    }

    if (!password) {
      fail("Please enter a password first");
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      fail(passwordValidation.error || "Invalid password");
      return;
    }

    if (!name) {
      fail("Please enter a name first");
      return;
    }

    if (!token) {
      fail("Authentication required");
      return;
    }

    try {
      setCreating(true);
      setError("");
      setFormError("");

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
      const message =
        err instanceof Error ? err.message : "Failed to create admin";
      setFormError(message);
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleDone = () => {
    if (!created) {
      fail("Create the admin first");
      return;
    }

    resetForm();
    onClose();
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12 text-left">
          <DialogTitle className="text-base font-semibold">
            Create admin
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            The new admin signs in with this password, then enrols an
            authenticator app.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              className="h-9"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setCreated(false);
              }}
              placeholder="admin@example.com"
              disabled={created}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              className="h-9"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setCreated(false);
              }}
              placeholder="At least 8 characters"
              minLength={8}
              disabled={created}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 8 characters. Share this password with the new admin.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              className="h-9"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setCreated(false);
              }}
              placeholder="Admin name"
              disabled={created}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => {
                setRole(value as "super-admin" | "admin");
                setCreated(false);
              }}
              disabled={created}
            >
              <SelectTrigger id="role" className="h-9 w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super-admin">Super admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formError && (
            <p
              role="alert"
              className="min-w-0 rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger"
            >
              {formError}
            </p>
          )}

          <Button
            type="button"
            variant={created ? "outline" : "default"}
            className={
              created
                ? "h-9 w-full border-success-line bg-success-surface text-success hover:bg-success-surface hover:text-success"
                : "h-9 w-full"
            }
            onClick={handleCreate}
            disabled={creating || created}
          >
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                Creating
              </>
            ) : created ? (
              <>
                <Check className="size-4" strokeWidth={2} />
                Admin created
              </>
            ) : (
              "Create admin"
            )}
          </Button>

          {created && (
            <p className="text-center text-xs text-success">
              They must enrol an authenticator app on first login.
            </p>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
          <Button
            variant="outline"
            className="h-9"
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button className="h-9" onClick={handleDone} disabled={!created}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
