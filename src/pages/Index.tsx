import { useState } from "react";
import ProfileSetup, { type ProfileData } from "@/components/ProfileSetup";
import TryOnViewer from "@/components/TryOnViewer";

const Index = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      {/* Extension popup container */}
      <div className="w-[400px] h-[600px] rounded-2xl border border-border/50 overflow-hidden shadow-2xl shadow-primary/5 flex flex-col">
        {profile ? (
          <TryOnViewer profile={profile} onReset={() => setProfile(null)} />
        ) : (
          <ProfileSetup onComplete={setProfile} />
        )}
      </div>
    </div>
  );
};

export default Index;
