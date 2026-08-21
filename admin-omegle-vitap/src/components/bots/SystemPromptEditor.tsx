"use client";

import { motion } from "framer-motion";
import { MessageSquare, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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

export function SystemPromptEditor({
  value,
  onChange,
  resetDialogOpen,
  onResetDialogChange,
  onReset,
}: SystemPromptEditorProps) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="bg-zinc-900/50 border-zinc-800 h-full">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                  System Prompt
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Configure the AI personality and behavior
                </CardDescription>
              </div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="self-end sm:self-auto"
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onResetDialogChange(true)}
                  className="border-zinc-700"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </motion.div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[200px] sm:min-h-[300px] bg-zinc-800 border-zinc-700 font-mono text-xs sm:text-sm transition-all focus:border-purple-500/50"
              placeholder="Enter the system prompt for the AI bots..."
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-[10px] sm:text-xs text-zinc-400 space-y-1"
            >
              <p>
                <strong>Available placeholders:</strong>
              </p>
              <p className="font-mono break-all">
                {"{name}"} {"{age}"} {"{year}"} {"{branch}"} {"{college}"}{" "}
                {"{personality}"} {"{hobbies}"}
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Reset Prompt Confirmation */}
      <AlertDialog open={resetDialogOpen} onOpenChange={onResetDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset System Prompt</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset the system prompt to the default?
              This will overwrite your current custom prompt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onReset}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Reset to Default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
