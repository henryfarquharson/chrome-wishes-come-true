import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(apiKey: string, messages: any[]) {
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
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) {
    console.error("No image in response:", JSON.stringify(data).slice(0, 500));
    throw { status: 500, message: "AI did not return an image. Please try again." };
  }
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

    let imageUrl: string;

    if (action === "blend-face") {
      const { faceImage, mannequinImage, gender } = body;
      const prompt = `Take the mannequin/doll image and seamlessly blend the person's face from the second image onto the mannequin's head. Make it look natural and realistic - match skin tones, lighting, and proportions. The face should look like it belongs on the mannequin body. Keep the mannequin's body, pose, and clothing exactly the same. Only replace the head/face area.`;
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
      
      // Step 1: Fetch the product image if it's a URL (not base64)
      let productImage = productImageUrl;
      if (productImageUrl && !productImageUrl.startsWith("data:")) {
        // Use AI to extract and understand the clothing from the product page/image URL
        // We pass the URL directly - Gemini can handle URLs
        productImage = productImageUrl;
      }

      const prompt = `You are a virtual try-on AI. Take the clothing item shown in the second image and realistically place it on the mannequin in the first image. 
The clothing should:
- Fit naturally on the mannequin's body shape and proportions
- Show realistic draping, folds, and shadows
- Maintain the clothing's original color, pattern, and texture
- Replace the mannequin's current clothing with the new garment
- Look like a real photo of someone wearing this clothing
Keep the mannequin's face, skin, pose, and body shape exactly the same. Only change what they're wearing.`;

      imageUrl = await callAI(LOVABLE_API_KEY, [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: mannequinImage } },
          { type: "image_url", image_url: { url: productImage } },
        ],
      }]);

    } else {
      throw { status: 400, message: "Invalid action" };
    }

    console.log(`Successfully processed ${action} request`);
    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("process-mannequin error:", e);
    const status = e?.status || 500;
    const message = e?.message || "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
