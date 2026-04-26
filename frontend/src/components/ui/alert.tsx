import * as React from "react";
import { cn } from "@/lib/utils";

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" | "success" }>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantStyles = {
      default: "bg-background text-foreground border-border",
      destructive: "border-destructive/50 text-destructive bg-destructive/10",
      success: "bg-emerald-50 text-emerald-700 border-emerald-200"
    };
    return (
      <div ref={ref} role="alert" className={cn("relative w-full rounded-lg border px-4 py-3 text-sm", variantStyles[variant], className)} {...props} />
    );
  }
);
Alert.displayName = "Alert";

export { Alert };
