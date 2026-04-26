import { useShellStore } from "@/stores/shellStore";
import { Alert } from "@/components/ui/alert";

export function GlobalBanner() {
  const { globalError, globalNotice, clearGlobalState } = useShellStore();

  if (!globalError && !globalNotice) return null;

  return (
    <div className="px-4 pt-2">
      {globalError && (
        <Alert variant="destructive" className="mb-2 cursor-pointer" onClick={clearGlobalState}>
          {globalError}
        </Alert>
      )}
      {globalNotice && (
        <Alert variant="success" className="mb-2 cursor-pointer" onClick={clearGlobalState}>
          {globalNotice}
        </Alert>
      )}
    </div>
  );
}
