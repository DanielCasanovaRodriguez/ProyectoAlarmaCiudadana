import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Colores explícitos — NO depender de herencia para evitar texto invisible
        "text-gray-900 bg-input-background",
        // Placeholder, file, selection
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
        // Layout y forma
        "flex h-9 w-full min-w-0 rounded-md border border-input px-3 py-1 text-base",
        // Transición y outline
        "transition-[color,box-shadow] outline-none",
        // File input
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // Focus ring
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        // Dark mode
        "dark:bg-input/30",
        // Aria invalid
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        // Tamaño en md
        "md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
