import { useState, useRef, useEffect } from "react";
import {
  RotateCcw,
  ShoppingBag,
  User,
  Camera,
  
  Upload,
  ImageIcon,
  LogOut,
  Shirt,
  Save,
  BookOpen,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import dollMale from "@/assets/doll-male.png";
import dollFemale from "@/assets/doll-female.png";
import { type BodyProportions, defaultMaleCm, defaultFemaleCm } from "./BodyCustomizer";
import ProcessingOverlay, { type ProcessingStep } from "./ProcessingOverlay";
import OnboardingTutorial from "./OnboardingTutorial";
import type { ProfileData } from "./ProfileSetup";

interface ClosetItem {
  id: string;
  product_image: string;
  result_image: string;
  product_name: string | null;
  created_at: string;
}

interface TryOnViewerProps {
  profile: ProfileData;
  onReset: () => void;
  onSaveMannequin?: (mannequinImage: string) => void;
  userId?: string;
}

// Will be set based on gender in the component
function getDefaults(gender: string): BodyProportions {
  return gender === "female" ? { ...defaultFemaleCm } : { ...defaultMaleCm };
}

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

/** Replace near-#d5d3d0 background pixels with exact #d5d3d0 */
function normalizeBackground(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!src) return reject("No image source");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      // Target: #d5d3d0 = RGB(213, 211, 208)
      const tR = 213, tG = 211, tB = 208;
      const tolerance = 30; // pixels within this range get snapped
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const dist = Math.abs(r - tR) + Math.abs(g - tG) + Math.abs(b - tB);
        if (dist <= tolerance) {
          data[i] = tR;
          data[i + 1] = tG;
          data[i + 2] = tB;
        }
      }
      ctx.putImageData(imageData, 0, 0);
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

/** Auto-dismissing product loaded notification */
const ProductLoadedBar = ({ productUrl, onDismiss }: { productUrl: string; onDismiss: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
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
  );
};

const TryOnViewer = ({ profile, onReset, onSaveMannequin, userId }: TryOnViewerProps) => {
  const [productUrl, setProductUrl] = useState("");
  const [hasProduct, setHasProduct] = useState(false);
  const [faceImage, setFaceImage] = useState<string | null>(profile.photo);
  const [savedProportions] = useState<BodyProportions>(() => {
    return getDefaults(profile.gender);
  });
  const [currentMannequin, setCurrentMannequin] = useState<string | null>(profile.baseMannequin || null);
  const [baseMannequinState, setBaseMannequinState] = useState<string | null>(profile.baseMannequin || null);
  const [steps, setSteps] = useState<ProcessingStep[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<(() => void) | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [showCloset, setShowCloset] = useState(false);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [savingToCloset, setSavingToCloset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  
  const hasAutoBlended = useRef(false);
  const [showTutorial, setShowTutorial] = useState(() => {
    return !localStorage.getItem("quin-fit-tutorial-seen");
  });

  const baseDoll = profile.gender === "female" ? dollFemale : dollMale;
  const displayImage = currentMannequin || baseDoll;
  const isProcessing = steps.some((s) => s.status === "active");

  // Auto-blend face from onboarding photo on first mount
  useEffect(() => {
    if (faceImage && !currentMannequin && !hasAutoBlended.current) {
      hasAutoBlended.current = true;
      runFaceBlend(faceImage);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStep = (id: string, status: ProcessingStep["status"]) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const clearProcessing = () => {
    setSteps([]);
    setErrorMessage(null);
    setLastFailedAction(null);
  };

  // No auto-reshape on mount; user adjusts sliders and sees instant CSS feedback

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
      const normalized = await normalizeBackground(result);
      setCurrentMannequin(normalized);
      setBaseMannequinState(normalized);
      onSaveMannequin?.(normalized);
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

  // Reshape is now handled during onboarding; no slider panel in viewer

  const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setProductImage(dataUrl);
      setProductUrl(file.name);
      toast.success("Product loaded! Press Try On to see it on your body.");
    };
    reader.readAsDataURL(file);
  };

  const handleTryOn = async () => {
    if (productImage) {
      runTryOn(productImage);
    } else if (productUrl) {
      // Check if URL looks like a direct image URL
      const isDirectImage = /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?.*)?$/i.test(productUrl);
      if (!isDirectImage) {
        toast.error("Please upload a product image or paste a direct image URL (ending in .jpg, .png, etc.)");
        return;
      }
      runTryOn(productUrl);
    }
  };

  const runTryOn = async (imageSource: string) => {
    const tryOnSteps: ProcessingStep[] = [
      { id: "fetch", label: "Preparing product image...", status: "active" },
      { id: "analyze", label: "Analyzing clothing...", status: "pending" },
      { id: "fit", label: "Fitting to your body...", status: "pending" },
      { id: "render", label: "Rendering final look...", status: "pending" },
    ];
    setSteps(tryOnSteps);
    setErrorMessage(null);

    try {
      // If it's a URL, fetch and convert to base64 client-side
      let productBase64 = imageSource;
      if (imageSource.startsWith("http")) {
        productBase64 = await compressImage(imageSource, 800);
      } else if (imageSource.startsWith("data:")) {
        productBase64 = await compressImage(imageSource, 800);
      }

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
        productImageUrl: productBase64,
        gender: profile.gender,
      });

      updateStep("fit", "done");
      updateStep("render", "active");
      const normalizedTryOn = await normalizeBackground(result);
      setCurrentMannequin(normalizedTryOn);
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
      setLastFailedAction(() => () => runTryOn(imageSource));
    }
  };

  const handleUndress = () => {
    setCurrentMannequin(baseMannequinState || baseDoll);
    setHasProduct(false);
    setProductImage(null);
    setProductUrl("");
    toast.success("Clothes removed — ready for a new outfit!");
  };

  const handleSaveToCloset = async () => {
    if (!userId || !currentMannequin || !productImage) return;
    setSavingToCloset(true);
    try {
      const { error } = await supabase.from("closet_items").insert({
        user_id: userId,
        product_image: productImage,
        result_image: currentMannequin,
        product_name: productUrl || "Unnamed item",
      });
      if (error) throw error;
      toast.success("Saved to your closet!");
    } catch (err: any) {
      console.error("Save to closet error:", err);
      toast.error("Failed to save to closet");
    } finally {
      setSavingToCloset(false);
    }
  };

  const loadCloset = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("closet_items")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setClosetItems((data as ClosetItem[]) || []);
    } catch (err) {
      console.error("Load closet error:", err);
    }
  };

  const handleDeleteClosetItem = async (id: string) => {
    try {
      const { error } = await supabase.from("closet_items").delete().eq("id", id);
      if (error) throw error;
      setClosetItems((prev) => prev.filter((item) => item.id !== id));
      toast.success("Removed from closet");
    } catch (err) {
      console.error("Delete closet item error:", err);
    }
  };

  const handleTryOnFromCloset = (item: ClosetItem) => {
    setCurrentMannequin(item.result_image);
    setProductImage(item.product_image);
    setProductUrl(item.product_name || "Closet item");
    setHasProduct(true);
    setShowCloset(false);
    toast.success("Outfit loaded from closet!");
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#d5d3d0' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card">
        <h1 className="font-sans font-semibold text-sm tracking-tight text-foreground">
          Quin Fit
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowCloset(!showCloset); if (!showCloset) loadCloset(); }}
            className={`p-1.5 rounded-md transition-colors ${
              showCloset
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="My Closet"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Edit profile"
          >
            <User className="w-4 h-4" />
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Body viewer */}
        <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: '#d5d3d0' }}>
          <div className="relative z-10 h-full w-full overflow-hidden flex items-center justify-center">
            <img
              src={displayImage}
              alt="Your virtual doll"
              className="w-full h-full object-contain transition-transform duration-200 ease-out"
              style={{
                transform: (() => {
                  const defaults = getDefaults(profile.gender);
                  const p = savedProportions;
                  const sx = ((p.chest + p.waist + p.hips) / 3) / ((defaults.chest + defaults.waist + defaults.hips) / 3);
                  const sy = p.height / defaults.height;
                  return `scaleX(${sx.toFixed(3)}) scaleY(${sy.toFixed(3)})`;
                })(),
              }}
            />

            {/* Face upload - accessible from header camera icon only */}

            {!isProcessing && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                title={currentMannequin ? "Change face" : "Add face"}
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

          {/* First-time tutorial */}
          {showTutorial && !isProcessing && (
            <OnboardingTutorial
              onDismiss={() => {
                setShowTutorial(false);
                localStorage.setItem("quin-fit-tutorial-seen", "1");
              }}
            />
          )}

          {/* Bottom controls */}
          {!isProcessing && steps.length === 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {hasProduct && (
                <>
                  <button
                    onClick={handleUndress}
                    className="bg-foreground/10 backdrop-blur-sm border border-border/30 rounded-full px-3 py-1.5 text-xs text-muted-foreground/70 hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <Shirt className="w-3 h-3" />
                    Undress
                  </button>
                  {productImage && (
                    <button
                      onClick={handleSaveToCloset}
                      disabled={savingToCloset}
                      className="bg-foreground/10 backdrop-blur-sm border border-border/30 rounded-full px-3 py-1.5 text-xs text-muted-foreground/70 hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      {savingToCloset ? "Saving..." : "Save"}
                    </button>
                  )}
                </>
              )}
              <button className="bg-foreground/10 backdrop-blur-sm border border-border/30 rounded-full px-3 py-1.5 text-xs text-muted-foreground/70 hover:text-foreground transition-colors flex items-center gap-1">
                <RotateCcw className="w-3 h-3" />
                Rotate
              </button>
            </div>
          )}
        </div>


        {/* Closet panel */}
        {showCloset && (
          <div className="w-[200px] border-l border-border/50 p-3 overflow-y-auto animate-slide-up bg-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-sans font-semibold text-foreground uppercase tracking-wider">
                My Closet
              </p>
              <button onClick={() => setShowCloset(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {closetItems.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-4">
                No saved items yet. Try on clothing and hit Save!
              </p>
            ) : (
              <div className="space-y-2">
                {closetItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border/30 overflow-hidden bg-secondary/30 group"
                  >
                    <button
                      onClick={() => handleTryOnFromCloset(item)}
                      className="w-full"
                    >
                      <img
                        src={item.product_image}
                        alt={item.product_name || "Saved item"}
                        className="w-full aspect-square object-cover"
                      />
                    </button>
                    <div className="p-1.5 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground truncate flex-1">
                        {item.product_name || "Unnamed"}
                      </span>
                      <button
                        onClick={() => handleDeleteClosetItem(item.id)}
                        className="text-muted-foreground/50 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product info bar - auto-dismiss after 3s */}
      {hasProduct && !isProcessing && (
        <ProductLoadedBar productUrl={productUrl} onDismiss={() => setHasProduct(false)} />
      )}

      {/* Product URL input */}
      <div className="p-4 bg-card">
        {/* Product image preview */}
        {productImage && !isProcessing && (
          <div className="mb-3 flex items-center gap-2 bg-secondary/50 rounded-lg p-2">
            <img src={productImage} alt="Product" className="w-10 h-10 rounded object-cover" />
            <span className="text-xs text-muted-foreground flex-1 truncate">{productUrl}</span>
            <button
              onClick={() => { setProductImage(null); setProductUrl(""); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >✕</button>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            onClick={() => productInputRef.current?.click()}
            variant="outline"
            size="sm"
            className="shrink-0 border-border/50"
            disabled={isProcessing}
          >
            <Upload className="w-4 h-4" />
          </Button>
          <div className="relative flex-1">
            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={productUrl}
              onChange={(e) => { setProductUrl(e.target.value); setProductImage(null); }}
              placeholder="Upload image or paste image URL..."
              className="pl-9 bg-card border-border/50 text-sm"
              disabled={isProcessing}
            />
          </div>
          <Button
            onClick={handleTryOn}
            disabled={(!productUrl && !productImage) || isProcessing}
            className="bg-foreground text-background hover:bg-foreground/90 border-0 shrink-0 font-sans"
            size="sm"
          >
            Try On
          </Button>
        </div>
        <input
          ref={productInputRef}
          type="file"
          accept="image/*"
          onChange={handleProductUpload}
          className="hidden"
        />
        <p className="text-[10px] text-muted-foreground mt-2 text-center font-sans">
          Upload a product image or paste a direct image URL (.jpg, .png, .webp)
        </p>
      </div>
    </div>
  );
};

export default TryOnViewer;
