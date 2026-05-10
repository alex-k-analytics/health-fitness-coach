import { useEffect } from "react";
import { X } from "lucide-react";
import { useShellStore } from "@/stores/shellStore";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function GlobalBanner() {
  const { globalError, globalNotice, clearGlobalState } = useShellStore();

  useEffect(() => {
    if (!globalNotice || globalError) return;

    const timeout = window.setTimeout(clearGlobalState, 5_000);
    return () => window.clearTimeout(timeout);
  }, [clearGlobalState, globalError, globalNotice]);

  if (!globalError && !globalNotice) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(3.5rem+0.5rem)] z-50 mx-auto flex max-w-6xl flex-col gap-2 px-4 sm:inset-x-auto sm:right-4 sm:w-[min(28rem,calc(100vw-2rem))] sm:px-0">
      {globalError && (
        <Alert variant="destructive" className="pointer-events-auto grid-cols-[1fr_auto] items-center gap-x-3 py-2.5 pr-2 shadow-lg">
          <AlertDescription className="col-start-1 whitespace-normal leading-5">
            {globalError}
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
      )}
      {globalNotice && (
        <Alert variant="success" className="pointer-events-auto grid-cols-[1fr_auto] items-center gap-x-3 py-2.5 pr-2 shadow-lg">
          <AlertDescription className="col-start-1 whitespace-normal leading-5">
            {globalNotice}
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
      )}
    </div>
  );
}
