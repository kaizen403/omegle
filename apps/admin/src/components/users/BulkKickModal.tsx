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
  const isSingle = selectedCount === 1;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="min-w-0 truncate">
            {isSingle ? "Kick this user?" : "Kick these users?"}
          </DialogTitle>
        </DialogHeader>

        <div className="py-1">
          <p className="text-sm text-muted-foreground">
            {isSingle ? "This will remove " : "This will remove "}
            <span className="font-semibold tabular-nums text-foreground">
              {selectedCount}
            </span>{" "}
            {isSingle ? "user" : "users"} from their room
            {isSingle ? "" : "s"} and end the conversation
            {isSingle ? "" : "s"}.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            This cannot be undone.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {isSingle ? "Kick user" : `Kick ${selectedCount} users`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
