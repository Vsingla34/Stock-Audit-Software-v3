import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  /** Human-readable message to show the user */
  message: string;
  /** If provided, shows a "Try Again" button that calls this */
  onRetry?: () => void;
  /** Override the default "Try Again" label */
  retryLabel?: string;
}

/**
 * Full-panel error state — use inside a page or card when a data
 * fetch fails and there's nothing else to show.
 *
 * Usage:
 *   const [error, setError] = useState<string | null>(null);
 *   if (error) return <ErrorState message={error} onRetry={fetchData} />;
 */
export const ErrorState = ({ message, onRetry, retryLabel = "Try Again" }: ErrorStateProps) => (
  <div className="flex flex-col items-center justify-center py-20 px-4 gap-5 text-center">
    <div className="bg-red-50 p-5 rounded-full">
      <AlertTriangle className="h-9 w-9 text-red-500" />
    </div>
    <div className="space-y-1 max-w-sm">
      <p className="font-semibold text-gray-800">Something went wrong</p>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
    {onRetry && (
      <Button variant="outline" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        {retryLabel}
      </Button>
    )}
  </div>
);