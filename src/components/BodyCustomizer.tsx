import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface BodySlider {
  label: string;
  key: string;
  min: number;
  max: number;
  default: number;
  unit: string;
}

const sliders: BodySlider[] = [
  { label: "Height", key: "height", min: 50, max: 150, default: 100, unit: "%" },
  { label: "Chest", key: "chest", min: 70, max: 130, default: 100, unit: "%" },
  { label: "Waist", key: "waist", min: 70, max: 130, default: 100, unit: "%" },
  { label: "Hips", key: "hips", min: 70, max: 130, default: 100, unit: "%" },
  { label: "Legs", key: "legs", min: 70, max: 130, default: 100, unit: "%" },
];

export interface BodyProportions {
  height: number;
  chest: number;
  waist: number;
  hips: number;
  legs: number;
}

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
              {proportions[s.key as keyof BodyProportions]}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleChange(s.key, Math.max(s.min, proportions[s.key as keyof BodyProportions] - 5))}
              className="w-5 h-5 rounded bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <Slider
              value={[proportions[s.key as keyof BodyProportions]]}
              onValueChange={([v]) => handleChange(s.key, v)}
              min={s.min}
              max={s.max}
              step={1}
              className="flex-1"
            />
            <button
              onClick={() => handleChange(s.key, Math.min(s.max, proportions[s.key as keyof BodyProportions] + 5))}
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
