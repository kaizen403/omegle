"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/components/console";
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

interface SystemPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  resetDialogOpen: boolean;
  onResetDialogChange: (open: boolean) => void;
  onReset: () => void;
}

const PLACEHOLDERS = [
  "{name}",
  "{age}",
  "{year}",
  "{branch}",
  "{college}",
  "{personality}",
  "{hobbies}",
];

export function SystemPromptEditor({
  value,
  onChange,
  resetDialogOpen,
  onResetDialogChange,
  onReset,
}: SystemPromptEditorProps) {
  return (
    <>
      <Section
        title="System prompt"
        description="The personality and rules every bot is given before it replies."
        className="h-full"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <Textarea
            id="system-prompt"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Describe how the bots should behave…"
            spellCheck={false}
            className="h-[22rem] min-h-[16rem] w-full resize-y overflow-y-auto bg-card font-mono text-sm leading-6 field-sizing-fixed"
          />

          <div className="min-w-0 space-y-1.5">
            <p className="text-sm font-medium text-foreground">
              Available placeholders
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((token) => (
                <span key={token} className="id-chip">
                  {token}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              These are replaced with the bot&apos;s own details when the prompt
              is sent.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-4">
            <span className="min-w-0 text-xs text-muted-foreground tabular-nums">
              {value.length} characters
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResetDialogChange(true)}
              className="shrink-0"
            >
              <RotateCcw className="size-4" strokeWidth={2} />
              Reset to default
            </Button>
          </div>
        </div>
      </Section>

      {/* Reset Prompt Confirmation */}
      <AlertDialog open={resetDialogOpen} onOpenChange={onResetDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset system prompt</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the current prompt with the default one. Your custom
              prompt cannot be recovered afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onReset}>
              Reset to default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
