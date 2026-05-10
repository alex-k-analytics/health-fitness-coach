import { useShellStore } from "@/stores/shellStore";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function GlobalBanner() {
  const { globalError, globalNotice, clearGlobalState } = useShellStore();

  if (!globalError && !globalNotice) return null;

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-[calc(3.5rem+0.5rem)] z-50 mx-auto flex max-w-6xl flex-col gap-2 px-4">
      {globalError && (
        <Alert variant="destructive" className="pointer-events-auto cursor-pointer py-2.5 shadow-lg" onClick={clearGlobalState}>
          <AlertDescription className="whitespace-normal leading-5">
            {globalError}
          </AlertDescription>
        </Alert>
      )}
      {globalNotice && (
        <Alert variant="success" className="pointer-events-auto cursor-pointer py-2.5 shadow-lg" onClick={clearGlobalState}>
          <AlertDescription className="whitespace-normal leading-5">
            {globalNotice}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
