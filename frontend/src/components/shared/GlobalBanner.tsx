import { useShellStore } from "@/stores/shellStore";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function GlobalBanner() {
  const { globalError, globalNotice, clearGlobalState } = useShellStore();

  if (!globalError && !globalNotice) return null;

  return (
    <div className="px-4 pt-2 max-w-6xl mx-auto">
      {globalError && (
        <Alert variant="destructive" className="mb-2 cursor-pointer py-2.5" onClick={clearGlobalState}>
          <AlertDescription className="whitespace-normal leading-5">
            {globalError}
          </AlertDescription>
        </Alert>
      )}
      {globalNotice && (
        <Alert variant="success" className="mb-2 cursor-pointer py-2.5" onClick={clearGlobalState}>
          <AlertDescription className="whitespace-normal leading-5">
            {globalNotice}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
