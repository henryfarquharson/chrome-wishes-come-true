import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(apiKey: string, messages: any[]) {
  console.log("Calling AI gateway...");
  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages,
        modalities: ["image", "text"],
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("AI gateway error:", response.status, text);
    if (response.status === 429) throw { status: 429, message: "Rate limit exceeded. Please wait a moment and try again." };
    if (response.status === 402) throw { status: 402, message: "Usage limit reached. Please add credits in Settings → Workspace → Usage." };
    throw { status: response.status, message: `AI processing failed (${response.status}). Please try again.` };
  }

  const data = await response.json();
  console.log("AI response received, checking for image...");
  
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) {
    const textContent = data.choices?.[0]?.message?.content || "";
    console.error("No image in response. Text:", textContent.slice(0, 200));
    throw { status: 500, message: "AI could not generate the image. Try a different photo or try again." };
  }
  
  console.log("Image received successfully, length:", imageUrl.length);
  return imageUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw { status: 500, message: "Server configuration error" };

    const body = await req.json();
    const { action } = body;
    console.log(`Processing action: ${action}`);

    let imageUrl: string;

    if (action === "blend-face") {
      const { faceImage, mannequinImage, gender } = body;
      console.log("Face image length:", faceImage?.length || 0, "Mannequin length:", mannequinImage?.length || 0);
      
      const prompt = `You are a photo editing AI. I'm giving you two images:
1. First image: A mannequin/doll figure (off-white, featureless head)
2. Second image: A person's face photo

Your task: Replace the mannequin's blank/featureless head with the person's face from the second photo. 

Requirements:
- The person's face must be clearly recognizable - preserve ALL facial features exactly (eyes, nose, mouth, jawline, hair)
- Scale and position the face naturally on the mannequin's head
- Match the lighting direction and intensity to the mannequin image
- Blend the skin tone of the face smoothly into the mannequin's neck area
- Keep the mannequin's body, pose, and clothing completely unchanged
- The result should look like a realistic photo of this person standing in the mannequin's pose
- Preserve the person's hair style and color from the face photo`;

      imageUrl = await callAI(LOVABLE_API_KEY, [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: mannequinImage } },
          { type: "image_url", image_url: { url: faceImage } },
        ],
      }]);

    } else if (action === "reshape-body") {
      const { mannequinImage, gender, proportions } = body;
      const { height, chest, hips, legs } = proportions;
      const prompt = `Edit this mannequin/doll image to adjust body proportions: 
- Overall height scale: ${height}% (${height > 100 ? "taller" : height < 100 ? "shorter" : "normal"})
- Chest/torso width: ${chest}% (${chest > 100 ? "wider chest" : chest < 100 ? "narrower chest" : "normal"})
- Hip width: ${hips}% (${hips > 100 ? "wider hips" : hips < 100 ? "narrower hips" : "normal"})
- Leg length: ${legs}% (${legs > 100 ? "longer legs" : legs < 100 ? "shorter legs" : "normal"})
Keep the same style, pose, clothing, skin color, and background. Only adjust the body proportions naturally. The mannequin is ${gender === "female" ? "female wearing white athletic top and shorts" : "male wearing white underwear"}.`;
      
      imageUrl = await callAI(LOVABLE_API_KEY, [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: mannequinImage } },
        ],
      }]);

    } else if (action === "try-on") {
      const { mannequinImage, productImageUrl, gender } = body;
      console.log("Try-on with product URL:", productImageUrl?.slice(0, 100));

      const prompt = `You are a virtual try-on AI. I'm giving you two images:
1. First image: A person/mannequin figure
2. Second image: A clothing product photo

Your task: Dress the person/mannequin in the clothing item from the second image.

Requirements:
- Identify what type of clothing it is (shirt, pants, dress, jacket, etc.)
- Place the clothing realistically on the mannequin's body
- Show natural fabric draping, wrinkles, and shadows
- Maintain the clothing's exact color, pattern, texture, and design details
- If it's a top: replace the mannequin's current top/chest covering
- If it's pants: replace the mannequin's current bottom covering  
- If it's a full outfit: replace everything
- Keep the person's face, skin, and body shape exactly the same
- The final image should look like a real photo of someone wearing this clothing`;

      const content: any[] = [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: mannequinImage } },
      ];

      // If it's a URL, pass it directly (Gemini can fetch URLs)
      if (productImageUrl.startsWith("http")) {
        content.push({ type: "image_url", image_url: { url: productImageUrl } });
      } else {
        content.push({ type: "image_url", image_url: { url: productImageUrl } });
      }

      imageUrl = await callAI(LOVABLE_API_KEY, [{
        role: "user",
        content,
      }]);

    } else {
      throw { status: 400, message: "Invalid action" };
    }

    console.log(`Successfully processed ${action}`);
    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("process-mannequin error:", e);
    const status = e?.status || 500;
    const message = e?.message || "Something went wrong. Please try again.";
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
