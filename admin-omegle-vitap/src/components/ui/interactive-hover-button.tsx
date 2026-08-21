import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function InteractiveHoverButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "group/btn relative w-auto cursor-pointer overflow-hidden rounded-full border bg-background p-2 px-6 text-center font-semibold",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary transition-all duration-300 group-hover/btn:scale-[100.8]"></div>
        <span className="inline-block transition-all duration-300 group-hover/btn:translate-x-12 group-hover/btn:opacity-0">
          {children}
        </span>
      </div>
      <div className="absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 text-primary-foreground opacity-0 transition-all duration-300 group-hover/btn:translate-x-0 group-hover/btn:opacity-100">
        <span>{children}</span>
        <ArrowRight />
      </div>
    </button>
  );
}
