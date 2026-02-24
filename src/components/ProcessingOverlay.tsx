import { Progress } from "@/components/ui/progress";
import { Check, Loader2 } from "lucide-react";

export interface ProcessingStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
}

interface ProcessingOverlayProps {
  steps: ProcessingStep[];
  errorMessage?: string | null;
  onRetry?: () => void;
}

const ProcessingOverlay = ({ steps, errorMessage, onRetry }: ProcessingOverlayProps) => {
  const doneCount = steps.filter((s) => s.status === "done").length;
  const progress = steps.length > 0 ? (doneCount / steps.length) * 100 : 0;
  const hasError = steps.some((s) => s.status === "error");

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm z-20">
      <div className="w-[260px] space-y-4 p-4">
        {/* Progress bar */}
        <Progress value={progress} className="h-1.5" />

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-2">
              {step.status === "done" ? (
                <Check className="w-3.5 h-3.5 text-foreground shrink-0" />
              ) : step.status === "active" ? (
                <Loader2 className="w-3.5 h-3.5 text-foreground animate-spin shrink-0" />
              ) : step.status === "error" ? (
                <div className="w-3.5 h-3.5 rounded-full bg-destructive shrink-0" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full bg-muted shrink-0" />
              )}
              <span
                className={`text-xs font-sans ${
                  step.status === "active"
                    ? "text-foreground font-medium"
                    : step.status === "error"
                    ? "text-destructive"
                    : step.status === "done"
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error + retry */}
        {hasError && errorMessage && (
          <div className="space-y-2">
            <p className="text-[11px] text-destructive font-sans">{errorMessage}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full text-xs font-sans font-medium bg-foreground text-background rounded-md py-1.5 hover:bg-foreground/90 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcessingOverlay;
