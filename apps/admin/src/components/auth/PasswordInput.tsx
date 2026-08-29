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
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-2">
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
            className="w-12 h-14 text-center text-2xl font-semibold bg-white border-2 border-sky-100 rounded-lg focus:border-sky-400 focus:outline-none text-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            autoFocus={index === 0}
          />
        ))}
      </div>

      <div className="flex gap-3 w-full">
        {onCancel && (
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={disabled}
            className="flex-1"
          >
            Cancel
          </Button>
        )}
        <Button
          variant="default"
          onClick={handleSubmit}
          disabled={!isComplete || disabled}
          className="flex-1"
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
