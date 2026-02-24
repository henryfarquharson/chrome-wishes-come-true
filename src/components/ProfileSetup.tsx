import { useState } from "react";
import { Camera, ChevronRight, Ruler, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProfileSetupProps {
  onComplete: (profile: ProfileData) => void;
}

export interface ProfileData {
  photo: string | null;
  height: string;
  weight: string;
  gender: string;
  chest: string;
  waist: string;
  hips: string;
  baseMannequin?: string | null;
}

const ProfileSetup = ({ onComplete }: ProfileSetupProps) => {
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = () => {
    onComplete({ photo, height, weight, gender, chest, waist, hips });
  };

  return (
    <div className="flex flex-col h-full animate-slide-up">
      {/* Progress bar */}
      <div className="flex gap-1.5 px-6 pt-6 pb-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              i <= step ? "gradient-primary" : "bg-secondary"
            }`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-display font-bold">Your Photo</h2>
            <p className="text-muted-foreground text-sm">
              Upload a full-body photo for the most accurate try-on
            </p>
          </div>

          <label className="relative w-40 h-40 rounded-2xl glass flex items-center justify-center cursor-pointer group hover:border-primary/50 transition-all overflow-hidden">
            {photo ? (
              <img
                src={photo}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                <Camera className="w-8 h-8" />
                <span className="text-xs font-medium">Upload Photo</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </label>

          <Button
            onClick={() => setStep(1)}
            className="w-full gradient-primary text-primary-foreground border-0 glow-primary"
          >
            {photo ? "Continue" : "Skip for now"}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="flex-1 flex flex-col px-6 gap-5 pt-4">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-display font-bold">
              <User className="inline w-5 h-5 mr-2 mb-1" />
              Basic Info
            </h2>
            <p className="text-muted-foreground text-sm">
              Help us create your virtual body
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                Gender
              </Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="glass border-border/50">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="nonbinary">Non-binary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  Height (cm)
                </Label>
                <Input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="175"
                  className="glass border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  Weight (kg)
                </Label>
                <Input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="70"
                  className="glass border-border/50"
                />
              </div>
            </div>
          </div>

          <div className="mt-auto pb-6">
            <Button
              onClick={() => setStep(2)}
              className="w-full gradient-primary text-primary-foreground border-0 glow-primary"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex-1 flex flex-col px-6 gap-5 pt-4">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-display font-bold">
              <Ruler className="inline w-5 h-5 mr-2 mb-1" />
              Measurements
            </h2>
            <p className="text-muted-foreground text-sm">
              Optional but improves accuracy
            </p>
          </div>

          <div className="space-y-4">
            {[
              { label: "Chest", value: chest, setter: setChest, placeholder: "96" },
              { label: "Waist", value: waist, setter: setWaist, placeholder: "80" },
              { label: "Hips", value: hips, setter: setHips, placeholder: "98" },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label} className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">
                  {label} (cm)
                </Label>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  className="glass border-border/50"
                />
              </div>
            ))}
          </div>

          <div className="mt-auto pb-6">
            <Button
              onClick={handleComplete}
              className="w-full gradient-primary text-primary-foreground border-0 glow-primary"
            >
              Start Trying On
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSetup;
