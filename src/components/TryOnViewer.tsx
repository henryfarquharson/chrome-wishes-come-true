import { useState, useRef } from "react";
import {
  Link2,
  RotateCcw,
  ShoppingBag,
  User,
  Loader2,
  Camera,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import dollMale from "@/assets/doll-male.png";
import dollFemale from "@/assets/doll-female.png";
import BodyCustomizer, { type BodyProportions } from "./BodyCustomizer";
import type { ProfileData } from "./ProfileSetup";

interface TryOnViewerProps {
  profile: ProfileData;
  onReset: () => void;
}

const defaultProportions: BodyProportions = {
  height: 100,
  chest: 100,
  hips: 100,
  legs: 100,
};

const TryOnViewer = ({ profile, onReset }: TryOnViewerProps) => {
  const [productUrl, setProductUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProduct, setHasProduct] = useState(false);
  const [faceImage, setFaceImage] = useState<string | null>(profile.photo);
  const [proportions, setProportions] = useState<BodyProportions>(defaultProportions);
  const [showSliders, setShowSliders] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dollImage = profile.gender === "female" ? dollFemale : dollMale;

  const handleTryOn = () => {
    if (!productUrl) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setHasProduct(true);
    }, 2500);
  };

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFaceImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Calculate mannequin transform based on proportions
  const bodyStyle = {
    transform: `scaleY(${proportions.height / 100})`,
    transformOrigin: "bottom center",
  };

  // Upper body (chest) scaling
  const upperBodyStyle = {
    transform: `scaleX(${proportions.chest / 100})`,
    transformOrigin: "center",
  };

  // Clip paths to simulate body section scaling
  const mannequinScale = proportions.height / 100;

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h1 className="font-sans font-semibold text-sm tracking-tight text-foreground">
          FitVision
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSliders(!showSliders)}
            className={`p-1.5 rounded-md transition-colors ${
              showSliders
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Body viewer */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-secondary/30">
          <div
            className="relative z-10"
            style={{ transform: `scale(${mannequinScale})`, transformOrigin: "bottom center" }}
          >
            {/* Mannequin body */}
            <div
              style={{
                transform: `scaleX(${proportions.chest / 100})`,
                transformOrigin: "center top",
              }}
            >
              <img
                src={dollImage}
                alt="Your virtual doll"
                className="max-h-[380px] object-contain"
              />
            </div>

            {/* Face overlay */}
            <div className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[22%] aspect-square">
              {faceImage ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full rounded-full overflow-hidden border-2 border-primary/30 hover:border-primary transition-colors group"
                >
                  <img
                    src={faceImage}
                    alt="Your face"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                    <Camera className="w-4 h-4 text-foreground" />
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full rounded-full border-2 border-dashed border-muted-foreground/40 hover:border-primary/60 transition-colors flex items-center justify-center bg-secondary/50"
                >
                  <Camera className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFaceUpload}
              className="hidden"
            />
          </div>

          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-foreground animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Fitting garment...
                </span>
              </div>
            </div>
          )}

          {/* Rotation controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            <button className="bg-foreground/10 backdrop-blur-sm border border-border/30 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              Rotate
            </button>
          </div>
        </div>

        {/* Sliders panel */}
        {showSliders && (
          <div className="w-[160px] border-l border-border/50 p-3 overflow-y-auto animate-slide-up">
            <p className="text-[11px] font-sans font-semibold text-foreground mb-3 uppercase tracking-wider">
              Body
            </p>
            <BodyCustomizer
              proportions={proportions}
              onChange={setProportions}
            />
          </div>
        )}
      </div>

      {/* Product info bar */}
      {hasProduct && (
        <div className="mx-4 mb-2 bg-secondary rounded-xl p-3 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium font-sans truncate">Product loaded</p>
              <p className="text-xs text-muted-foreground truncate">{productUrl}</p>
            </div>
            <span className="text-xs font-sans font-medium text-foreground">
              Fitted ✓
            </span>
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
              className="pl-9 bg-secondary border-border/50 text-sm"
            />
          </div>
          <Button
            onClick={handleTryOn}
            disabled={!productUrl || isProcessing}
            className="bg-foreground text-background hover:bg-foreground/90 border-0 shrink-0 font-sans"
            size="sm"
          >
            Try On
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center font-sans">
          Works with Zara, H&M, Nike, ASOS & more
        </p>
      </div>
    </div>
  );
};

export default TryOnViewer;
