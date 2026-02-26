import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ProfileSetup, { type ProfileData } from "@/components/ProfileSetup";
import TryOnViewer from "@/components/TryOnViewer";
import { toast } from "sonner";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Load saved profile from database
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        // If profile has gender set (not default) and has measurements, skip onboarding
        if (data && data.gender && data.gender !== "") {
          setProfile({
            photo: data.face_image || null,
            height: data.height_cm?.toString() || "",
            weight: data.weight_kg?.toString() || "",
            gender: data.gender,
            chest: data.chest_cm?.toString() || "",
            waist: data.waist_cm?.toString() || "",
            hips: data.hips_cm?.toString() || "",
            baseMannequin: data.base_mannequin || null,
          });
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, [user]);

  // Save profile after onboarding
  const handleProfileComplete = async (profileData: ProfileData) => {
    setProfile(profileData);

    if (user) {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({
            gender: profileData.gender,
            height_cm: profileData.height ? parseFloat(profileData.height) : null,
            weight_kg: profileData.weight ? parseFloat(profileData.weight) : null,
            chest_cm: profileData.chest ? parseFloat(profileData.chest) : null,
            waist_cm: profileData.waist ? parseFloat(profileData.waist) : null,
            hips_cm: profileData.hips ? parseFloat(profileData.hips) : null,
            face_image: profileData.photo,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (error) throw error;
        toast.success("Profile saved!");
      } catch (err) {
        console.error("Error saving profile:", err);
      }
    }
  };

  // Save base mannequin (after face blend / reshape)
  const handleSaveMannequin = async (mannequinImage: string) => {
    if (!user) return;
    try {
      await supabase
        .from("profiles")
        .update({ base_mannequin: mannequinImage, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    } catch (err) {
      console.error("Error saving mannequin:", err);
    }
  };

  if (authLoading || (user && loadingProfile)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-muted-foreground text-sm font-sans">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-[400px] h-[600px] rounded-2xl overflow-hidden shadow-2xl shadow-primary/5 flex flex-col">
        {profile ? (
          <TryOnViewer
            profile={profile}
            onReset={() => setProfile(null)}
            onSaveMannequin={handleSaveMannequin}
            userId={user.id}
          />
        ) : (
          <ProfileSetup onComplete={handleProfileComplete} />
        )}
      </div>
    </div>
  );
};

export default Index;
