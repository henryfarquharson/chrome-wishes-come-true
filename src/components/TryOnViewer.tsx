import { useState, useRef, useCallback, useEffect } from "react";
import {
  Link2,
  RotateCcw,
  ShoppingBag,
  User,
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
import ProcessingOverlay, { type ProcessingStep } from "./ProcessingOverlay";
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

/** Compress an image to max dimensions and return base64 */
function compressImage(src: string, maxSize = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!src) return reject("No image source");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject("Failed to load image");
    img.src = src;
  });
}

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

const MAX_RETRIES = 2;

async function callWithRetry(
  body: Record<string, unknown>,
  retries = MAX_RETRIES
): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke("process-mannequin", { body });
    if (error) throw new Error(error.message || "Request failed");
    if (data?.error) throw new Error(data.error);
    return data.imageUrl as string;
  } catch (err: any) {
    if (retries > 0 && !err.message?.includes("Usage limit") && !err.message?.includes("402")) {
      console.log(`Retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, 1500));
      return callWithRetry(body, retries - 1);
    }
    throw err;
  }
}

const TryOnViewer = ({ profile, onReset }: TryOnViewerProps) => {
  const [productUrl, setProductUrl] = useState("");
  const [hasProduct, setHasProduct] = useState(false);
  const [faceImage, setFaceImage] = useState<string | null>(profile.photo);
  const [proportions, setProportions] = useState<BodyProportions>(defaultProportions);
  const [showSliders, setShowSliders] = useState(false);
  const [currentMannequin, setCurrentMannequin] = useState<string | null>(null);
  const [steps, setSteps] = useState<ProcessingStep[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reshapeTimeout = useRef<ReturnType<typeof setTimeout>>();
  const hasAutoBlended = useRef(false);

  const baseDoll = profile.gender === "female" ? dollFemale : dollMale;
  const displayImage = currentMannequin || baseDoll;
  const isProcessing = steps.some((s) => s.status === "active");

  const updateStep = (id: string, status: ProcessingStep["status"]) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const clearProcessing = () => {
    setSteps([]);
    setErrorMessage(null);
    setLastFailedAction(null);
  };

  // Auto-trigger face blend if user uploaded a photo during profile setup
  useEffect(() => {
    if (profile.photo && !hasAutoBlended.current) {
      hasAutoBlended.current = true;
      runFaceBlend(profile.photo);
    }
  }, [profile.photo]);

  const handleFaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const faceDataUrl = reader.result as string;
      setFaceImage(faceDataUrl);
      runFaceBlend(faceDataUrl);
    };
    reader.readAsDataURL(file);
  };

  const runFaceBlend = async (face: string) => {
    const newSteps: ProcessingStep[] = [
      { id: "prepare", label: "Preparing images...", status: "active" },
      { id: "blend", label: "Blending face with AI...", status: "pending" },
      { id: "finalize", label: "Finalizing result...", status: "pending" },
    ];
    setSteps(newSteps);
    setErrorMessage(null);

    try {
      // Compress both images to reduce payload size
      const [compressedFace, compressedMannequin] = await Promise.all([
        compressImage(face, 512),
        compressImage(await assetToBase64(currentMannequin || baseDoll), 800),
      ]);

      updateStep("prepare", "done");
      updateStep("blend", "active");

      const result = await callWithRetry({
        action: "blend-face",
        faceImage: compressedFace,
        mannequinImage: compressedMannequin,
        gender: profile.gender,
      });

      updateStep("blend", "done");
      updateStep("finalize", "active");
      setCurrentMannequin(result);
      updateStep("finalize", "done");
      toast.success("Face blended successfully!");
      setTimeout(clearProcessing, 1000);
    } catch (err: any) {
      console.error("Face blend error:", err);
      setSteps((prev) =>
        prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s))
      );
      setErrorMessage(err.message || "Failed to blend face. Please try again.");
      setLastFailedAction(() => () => runFaceBlend(face));
    }
  };

  const handleReshape = useCallback(
    (newProportions: BodyProportions) => {
      setProportions(newProportions);
      if (reshapeTimeout.current) clearTimeout(reshapeTimeout.current);

      reshapeTimeout.current = setTimeout(async () => {
        const isDefault = Object.values(newProportions).every((v) => v === 100);
        if (isDefault) {
          setCurrentMannequin(null);
          return;
        }

        const reshapeSteps: ProcessingStep[] = [
          { id: "prepare", label: "Preparing mannequin...", status: "active" },
          { id: "reshape", label: "Reshaping body with AI...", status: "pending" },
          ...(faceImage ? [{ id: "reblend", label: "Re-blending face...", status: "pending" as const }] : []),
          { id: "finalize", label: "Finalizing...", status: "pending" },
        ];
        setSteps(reshapeSteps);
        setErrorMessage(null);

        try {
          const mannequinBase64 = await compressImage(await assetToBase64(baseDoll), 800);
          updateStep("prepare", "done");
          updateStep("reshape", "active");

          const result = await callWithRetry({
            action: "reshape-body",
            mannequinImage: mannequinBase64,
            gender: profile.gender,
            proportions: newProportions,
          });
          updateStep("reshape", "done");
          setCurrentMannequin(result);

          if (faceImage) {
            updateStep("reblend", "active");
            const compressedFace = await compressImage(faceImage, 512);
            const blended = await callWithRetry({
              action: "blend-face",
              faceImage: compressedFace,
              mannequinImage: result,
              gender: profile.gender,
            });
            updateStep("reblend", "done");
            setCurrentMannequin(blended);
          }

          updateStep("finalize", "active");
          updateStep("finalize", "done");
          toast.success("Body reshaped!");
          setTimeout(clearProcessing, 1000);
        } catch (err: any) {
          console.error("Reshape error:", err);
          setErrorMessage(err.message || "Failed to reshape body");
          setSteps((prev) =>
            prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s))
          );
          setLastFailedAction(() => () => handleReshape(newProportions));
        }
      }, 1200);
    },
    [baseDoll, faceImage, profile.gender]
  );

  const handleTryOn = async () => {
    if (!productUrl) return;
    runTryOn(productUrl);
  };

  const runTryOn = async (url: string) => {
    const tryOnSteps: ProcessingStep[] = [
      { id: "fetch", label: "Fetching product image...", status: "active" },
      { id: "analyze", label: "Analyzing clothing...", status: "pending" },
      { id: "fit", label: "Fitting to your body...", status: "pending" },
      { id: "render", label: "Rendering final look...", status: "pending" },
    ];
    setSteps(tryOnSteps);
    setErrorMessage(null);

    try {
      const mannequinBase64 = await compressImage(
        await assetToBase64(currentMannequin || baseDoll),
        800
      );
      updateStep("fetch", "done");
      updateStep("analyze", "active");

      await new Promise((r) => setTimeout(r, 300));
      updateStep("analyze", "done");
      updateStep("fit", "active");

      const result = await callWithRetry({
        action: "try-on",
        mannequinImage: mannequinBase64,
        productImageUrl: url,
        gender: profile.gender,
      });

      updateStep("fit", "done");
      updateStep("render", "active");
      setCurrentMannequin(result);
      setHasProduct(true);
      updateStep("render", "done");
      toast.success("Clothing fitted!");
      setTimeout(clearProcessing, 1000);
    } catch (err: any) {
      console.error("Try-on error:", err);
      setErrorMessage(err.message || "Failed to fit clothing");
      setSteps((prev) =>
        prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s))
      );
      setLastFailedAction(() => () => runTryOn(url));
    }
  };

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
              className="max-h-full object-contain"
            />

            {/* Face upload button */}
            <div className="absolute top-[2%] left-1/2 -translate-x-1/2 w-[22%] aspect-square">
              {!currentMannequin && !isProcessing && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full rounded-full border-2 border-dashed border-muted-foreground/40 hover:border-foreground/60 transition-colors flex items-center justify-center bg-secondary/50"
                >
                  <Camera className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {currentMannequin && !isProcessing && (
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

          {/* Processing overlay with progress */}
          {steps.length > 0 && (
            <ProcessingOverlay
              steps={steps}
              errorMessage={errorMessage}
              onRetry={lastFailedAction ? () => lastFailedAction() : undefined}
            />
          )}

          {/* Rotation controls */}
          {!isProcessing && steps.length === 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <button className="bg-foreground/10 backdrop-blur-sm border border-border/30 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <RotateCcw className="w-3 h-3" />
                Rotate
              </button>
            </div>
          )}
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
      {hasProduct && !isProcessing && (
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
              disabled={isProcessing}
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
