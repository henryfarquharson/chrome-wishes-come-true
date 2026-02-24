import { useState, useRef, useCallback } from "react";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

/** Convert a local asset path to a base64 data URL */
async function assetToBase64(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const TryOnViewer = ({ profile, onReset }: TryOnViewerProps) => {
  const [productUrl, setProductUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProduct, setHasProduct] = useState(false);
  const [faceImage, setFaceImage] = useState<string | null>(profile.photo);
  const [proportions, setProportions] = useState<BodyProportions>(defaultProportions);
  const [showSliders, setShowSliders] = useState(false);
  const [isBlending, setIsBlending] = useState(false);
  const [isReshaping, setIsReshaping] = useState(false);
  const [currentMannequin, setCurrentMannequin] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reshapeTimeout = useRef<ReturnType<typeof setTimeout>>();

  const baseDoll = profile.gender === "female" ? dollFemale : dollMale;
  const displayImage = currentMannequin || baseDoll;

  const callProcessMannequin = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("process-mannequin", { body });
    if (error) throw new Error(error.message || "Failed to process image");
    if (data?.error) throw new Error(data.error);
    return data.imageUrl as string;
  };

  const handleFaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const faceDataUrl = reader.result as string;
      setFaceImage(faceDataUrl);
      setIsBlending(true);

      try {
        const mannequinBase64 = await assetToBase64(currentMannequin || baseDoll);
        const result = await callProcessMannequin({
          action: "blend-face",
          faceImage: faceDataUrl,
          mannequinImage: mannequinBase64,
          gender: profile.gender,
        });
        setCurrentMannequin(result);
        toast.success("Face blended successfully!");
      } catch (err: any) {
        console.error("Face blend error:", err);
        toast.error(err.message || "Failed to blend face");
      } finally {
        setIsBlending(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReshape = useCallback(
    (newProportions: BodyProportions) => {
      setProportions(newProportions);

      // Debounce the AI call
      if (reshapeTimeout.current) clearTimeout(reshapeTimeout.current);
      reshapeTimeout.current = setTimeout(async () => {
        // Only call AI if proportions differ from default
        const isDefault = Object.values(newProportions).every((v) => v === 100);
        if (isDefault) {
          setCurrentMannequin(null);
          return;
        }

        setIsReshaping(true);
        try {
          const mannequinBase64 = await assetToBase64(baseDoll);
          const result = await callProcessMannequin({
            action: "reshape-body",
            mannequinImage: mannequinBase64,
            gender: profile.gender,
            proportions: newProportions,
          });
          setCurrentMannequin(result);

          // If user has a face, re-blend it on the reshaped body
          if (faceImage) {
            const blended = await callProcessMannequin({
              action: "blend-face",
              faceImage,
              mannequinImage: result,
              gender: profile.gender,
            });
            setCurrentMannequin(blended);
          }
        } catch (err: any) {
          console.error("Reshape error:", err);
          toast.error(err.message || "Failed to reshape body");
        } finally {
          setIsReshaping(false);
        }
      }, 1200);
    },
    [baseDoll, faceImage, profile.gender]
  );

  const handleTryOn = () => {
    if (!productUrl) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setHasProduct(true);
    }, 2500);
  };

  const aiWorking = isBlending || isReshaping;

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
          <div className="relative z-10">
            <img
              src={displayImage}
              alt="Your virtual doll"
              className="max-h-[380px] object-contain"
            />

            {/* Face upload button (top of mannequin head) */}
            <div className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[22%] aspect-square">
              {!currentMannequin && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full rounded-full border-2 border-dashed border-muted-foreground/40 hover:border-foreground/60 transition-colors flex items-center justify-center bg-secondary/50"
                >
                  <Camera className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Re-upload face button when face is blended */}
            {currentMannequin && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                title="Change face"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFaceUpload}
              className="hidden"
            />
          </div>

          {/* AI processing overlay */}
          {(aiWorking || isProcessing) && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-foreground animate-spin" />
                <span className="text-sm text-muted-foreground">
                  {isBlending
                    ? "Blending your face..."
                    : isReshaping
                    ? "Reshaping body..."
                    : "Fitting garment..."}
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
            <BodyCustomizer proportions={proportions} onChange={handleReshape} />
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
            <span className="text-xs font-sans font-medium text-foreground">Fitted ✓</span>
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
