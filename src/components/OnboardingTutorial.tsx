import { useState } from "react";
import { Camera, SlidersHorizontal, Upload, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    icon: <Camera className="w-6 h-6" />,
    title: "Add Your Face",
    description: "Tap the camera icon on the mannequin's head to blend your face onto the doll.",
  },
  {
    icon: <SlidersHorizontal className="w-6 h-6" />,
    title: "Adjust Body Shape",
    description: "Use the sliders panel to fine-tune your body proportions for a more accurate fit.",
  },
  {
    icon: <Upload className="w-6 h-6" />,
    title: "Upload & Try On",
    description: "Screenshot a clothing item from any website, upload it, then press Try On to see it on you.",
  },
  {
    icon: <BookOpen className="w-6 h-6" />,
    title: "Save to Closet",
    description: "Love a look? Save it to your closet to revisit anytime.",
  },
];

interface OnboardingTutorialProps {
  onDismiss: () => void;
}

const OnboardingTutorial = ({ onDismiss }: OnboardingTutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onDismiss();
    }
  };

  const step = tutorialSteps[currentStep];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-[280px] bg-card rounded-2xl p-6 shadow-lg border border-border/50 space-y-4 animate-slide-up">
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex justify-center text-foreground">{step.icon}</div>
        <h3 className="text-center font-display font-semibold text-lg">{step.title}</h3>
        <p className="text-center text-muted-foreground text-sm leading-relaxed">
          {step.description}
        </p>

        {/* Dots */}
        <div className="flex justify-center gap-1.5">
          {tutorialSteps.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === currentStep ? "bg-foreground" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <Button
          onClick={handleNext}
          className="w-full bg-foreground text-background hover:bg-foreground/90 border-0 font-sans"
          size="sm"
        >
          {currentStep < tutorialSteps.length - 1 ? "Next" : "Got it!"}
        </Button>
      </div>
    </div>
  );
};

export default OnboardingTutorial;
