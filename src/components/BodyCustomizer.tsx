import { Minus, Plus } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface BodySlider {
  label: string;
  key: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const sliders: BodySlider[] = [
  { label: "Height", key: "height", min: 140, max: 210, step: 1, unit: "cm" },
  { label: "Chest", key: "chest", min: 60, max: 140, step: 1, unit: "cm" },
  { label: "Waist", key: "waist", min: 50, max: 130, step: 1, unit: "cm" },
  { label: "Hips", key: "hips", min: 60, max: 140, step: 1, unit: "cm" },
  { label: "Legs", key: "legs", min: 60, max: 110, step: 1, unit: "cm" },
];

export interface BodyProportions {
  height: number;
  chest: number;
  waist: number;
  hips: number;
  legs: number;
}

// Default average measurements in cm (used as baseline for scaling)
export const defaultMaleCm: BodyProportions = { height: 175, chest: 96, waist: 80, hips: 98, legs: 82 };
export const defaultFemaleCm: BodyProportions = { height: 163, chest: 90, waist: 70, hips: 100, legs: 76 };

interface BodyCustomizerProps {
  proportions: BodyProportions;
  onChange: (proportions: BodyProportions) => void;
}

const BodyCustomizer = ({ proportions, onChange }: BodyCustomizerProps) => {
  const handleChange = (key: string, value: number) => {
    onChange({ ...proportions, [key]: value });
  };

  return (
    <div className="space-y-3">
      {sliders.map((s) => (
        <div key={s.key} className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-sans">
              {s.label}
            </Label>
            <span className="text-[11px] text-muted-foreground font-sans tabular-nums">
              {proportions[s.key as keyof BodyProportions]}{s.unit}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleChange(s.key, Math.max(s.min, proportions[s.key as keyof BodyProportions] - s.step))}
              className="w-5 h-5 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <Slider
              value={[proportions[s.key as keyof BodyProportions]]}
              onValueChange={([v]) => handleChange(s.key, v)}
              min={s.min}
              max={s.max}
              step={s.step}
              className="flex-1"
            />
            <button
              onClick={() => handleChange(s.key, Math.min(s.max, proportions[s.key as keyof BodyProportions] + s.step))}
              className="w-5 h-5 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BodyCustomizer;
