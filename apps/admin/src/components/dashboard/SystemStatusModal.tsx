"use client";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_MESSAGE_LENGTH = 200;

interface SystemStatusModalProps {
  isOpen: boolean;
  /** Status being moved to: false = take the site down, true = bring it back. */
  pendingStatus: boolean | null;
  /** Optional note shown to end users while the site is down. */
  message: string;
  isSubmitting: boolean;
  onMessageChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Explicit confirmation for taking the public site up or down, using the same
 * AlertDialog pattern the rest of this page uses for destructive actions.
 */
export function SystemStatusModal({
  isOpen,
  pendingStatus,
  message,
  isSubmitting,
  onMessageChange,
  onOpenChange,
  onConfirm,
}: SystemStatusModalProps) {
  const takingDown = pendingStatus === false;

  return (
    <AlertDialog
      open={isOpen}
      // Ignore outside/escape closes mid-request so the dialog cannot vanish
      // while the POST is still in flight.
      onOpenChange={(open) => {
        if (!isSubmitting) onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {takingDown
              ? "Take the public site down?"
              : "Bring the public site back online?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {takingDown
              ? "Every user will be blocked from connecting and anyone currently chatting will be cut off. This affects the entire public site, not just this dashboard."
              : "Users will immediately be able to connect and start chats again."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* The message only has a home while the site is down, so it is only
            offered on the way down. Kept outside AlertDialogDescription, which
            renders a <p> and cannot legally contain a textarea. */}
        {takingDown && (
          <div className="space-y-2">
            <Label htmlFor="maintenance-message">
              Message shown to users (optional)
            </Label>
            <Textarea
              id="maintenance-message"
              value={message}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={isSubmitting}
              onChange={(event) => onMessageChange(event.target.value)}
              placeholder="e.g. Back in about 30 minutes - upgrading our servers."
              className="min-h-20 border-sky-200 bg-white"
            />
            <div className="text-right text-xs text-slate-400">
              {message.length}/{MAX_MESSAGE_LENGTH}
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            // Radix closes the dialog on action click by default; prevent that
            // so the button can show progress and the parent closes it only
            // once the request has settled.
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={isSubmitting}
            className={
              takingDown
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }
          >
            {isSubmitting
              ? "Applying..."
              : takingDown
                ? "Take site down"
                : "Bring site online"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
