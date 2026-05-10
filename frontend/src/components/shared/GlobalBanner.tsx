import { useEffect } from "react";
import { X } from "lucide-react";
import { useShellStore } from "@/stores/shellStore";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function GlobalBanner() {
  const { globalError, globalNotice, clearGlobalState } = useShellStore();
  const message = globalError || globalNotice;
  const isError = Boolean(globalError);

  useEffect(() => {
    if (!globalNotice || globalError) return;

    const timeout = window.setTimeout(clearGlobalState, 5_000);
    return () => window.clearTimeout(timeout);
  }, [clearGlobalState, globalError, globalNotice]);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-[calc(0.75rem+env(safe-area-inset-right))] z-50 flex w-fit max-w-[calc(100vw-1.5rem)] lg:bottom-auto lg:right-4 lg:top-[calc(3.5rem+0.75rem)] lg:w-[min(28rem,calc(100vw-2rem))]">
      <Alert
        variant={isError ? "destructive" : "success"}
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        aria-atomic="true"
        className="pointer-events-auto grid-cols-[1fr_auto] items-center gap-x-3 py-2.5 pr-2 shadow-lg"
      >
        <AlertDescription className="col-start-1 whitespace-normal leading-5">
          {message}
        </AlertDescription>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="col-start-2 row-start-1 text-current hover:bg-current/10"
          aria-label="Dismiss notification"
          onClick={clearGlobalState}
        >
          <X aria-hidden="true" />
        </Button>
      </Alert>
    </div>
  );
}
