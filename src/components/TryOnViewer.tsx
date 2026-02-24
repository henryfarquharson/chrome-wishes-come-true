import { useState } from "react";
import { Link2, RotateCcw, ShoppingBag, Sparkles, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import mannequinImage from "@/assets/mannequin.png";
import type { ProfileData } from "./ProfileSetup";

interface TryOnViewerProps {
  profile: ProfileData;
  onReset: () => void;
}

const TryOnViewer = ({ profile, onReset }: TryOnViewerProps) => {
  const [productUrl, setProductUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProduct, setHasProduct] = useState(false);

  const handleTryOn = () => {
    if (!productUrl) return;
    setIsProcessing(true);
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      setHasProduct(true);
    }, 2500);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="font-display font-bold text-sm tracking-tight">
            FitVision
          </h1>
        </div>
        <button
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <User className="w-4 h-4" />
        </button>
      </div>

      {/* Body viewer */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 rounded-full bg-primary/10 blur-[80px] animate-pulse-glow" />
        </div>

        <div className="relative z-10">
          {profile.photo ? (
            <img
              src={profile.photo}
              alt="Your body"
              className="max-h-[380px] object-contain rounded-lg"
            />
          ) : (
            <img
              src={mannequinImage}
              alt="Virtual mannequin"
              className="max-h-[380px] object-contain opacity-80"
            />
          )}

          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Fitting garment...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Rotation controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          <button className="glass rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            Rotate
          </button>
        </div>
      </div>

      {/* Product info bar */}
      {hasProduct && (
        <div className="mx-4 mb-2 glass rounded-xl p-3 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">Product loaded</p>
              <p className="text-xs text-muted-foreground truncate">
                {productUrl}
              </p>
            </div>
            <span className="text-xs font-display text-accent">Fitted ✓</span>
          </div>
        </div>
      )}

      {/* Product URL input */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="Paste clothing product URL..."
              className="pl-9 glass border-border/50 text-sm"
            />
          </div>
          <Button
            onClick={handleTryOn}
            disabled={!productUrl || isProcessing}
            className="gradient-primary text-primary-foreground border-0 glow-primary shrink-0"
            size="sm"
          >
            Try On
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Works with Zara, H&M, Nike, ASOS & more
        </p>
      </div>
    </div>
  );
};

export default TryOnViewer;
