"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";

interface PasswordInputProps {
  onSubmit: (password: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export default function PasswordInput({
  onSubmit,
  onCancel,
  disabled,
}: PasswordInputProps) {
  const [password, setPassword] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (disabled) return;
    if (value.length > 1) return;
    if (!/^\d*$/.test(value)) return;

    const newPassword = [...password];
    newPassword[index] = value;
    setPassword(newPassword);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !password[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = () => {
    if (disabled) return;
    const enteredPassword = password.join("");
    if (enteredPassword.length === 6) {
      onSubmit(enteredPassword);
    }
  };

  const isComplete = password.every((digit) => digit !== "");

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex items-center justify-center gap-2">
        {password.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={disabled}
            aria-label={`Digit ${index + 1} of 6`}
            className="h-12 w-10 shrink-0 rounded-md border border-input bg-card text-center text-lg font-semibold tabular-nums text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors duration-150 focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 sm:w-11"
            autoFocus={index === 0}
          />
        ))}
      </div>

      <div className="flex w-full flex-wrap gap-3">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={disabled}
            className="h-10 min-w-0 flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          variant="default"
          onClick={handleSubmit}
          disabled={!isComplete || disabled}
          className="h-10 min-w-0 flex-1"
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
