import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BulkKickModalProps {
  selectedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function BulkKickModal({
  selectedCount,
  onConfirm,
  onCancel,
}: BulkKickModalProps) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="bg-zinc-900 border border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Confirm User Kick
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-zinc-300 text-sm sm:text-base">
            Are you sure you want to kick{" "}
            <span className="text-red-400 font-bold">{selectedCount}</span>{" "}
            {selectedCount === 1 ? "user" : "users"} from{" "}
            {selectedCount === 1 ? "their" : "their"} room
            {selectedCount === 1 ? "" : "s"}?
          </p>
          <p className="text-zinc-500 text-xs sm:text-sm mt-2">
            This action cannot be undone.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            className="bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {selectedCount === 1 ? "Kick User" : `Kick ${selectedCount} Users`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
