import { useShellStore } from "@/stores/shellStore";
import { Alert } from "@/components/ui/alert";

export function GlobalBanner() {
  const { globalError, globalNotice, clearGlobalState } = useShellStore();

  if (!globalError && !globalNotice) return null;

  return (
    <div className="px-4 pt-2 max-w-6xl mx-auto">
      {globalError && (
        <Alert variant="destructive" className="mb-2 cursor-pointer py-2.5" onClick={clearGlobalState}>
          <span className="col-start-2 block whitespace-normal leading-5">{globalError}</span>
        </Alert>
      )}
      {globalNotice && (
        <Alert variant="success" className="mb-2 cursor-pointer py-2.5" onClick={clearGlobalState}>
          <span className="col-start-2 block whitespace-normal leading-5">{globalNotice}</span>
        </Alert>
      )}
    </div>
  );
}
