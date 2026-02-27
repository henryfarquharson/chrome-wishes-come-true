import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(apiKey: string, messages: any[]) {
  console.log("Calling Google Gemini API directly...");
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash-exp-image-generation",
        messages,
        modalities: ["image", "text"],
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("Gemini API error:", response.status, text);
    if (response.status === 429) throw { status: 429, message: "Rate limit exceeded. Please wait a moment and try again." };
    if (response.status === 403) throw { status: 403, message: "Invalid API key or quota exceeded. Check your Google Gemini API key." };
    throw { status: response.status, message: `AI processing failed (${response.status}). Please try again.` };
  }

  const data = await response.json();
  console.log("Gemini response received, checking for image...");
  
  // Google's response format: inline_data in parts
  const parts = data.choices?.[0]?.message?.content;
  let imageUrl: string | undefined;
  
  // Try Lovable gateway format first (images array)
  imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  
  // Try Google native format (parts with inline_data)
  if (!imageUrl && Array.isArray(parts)) {
    for (const part of parts) {
      if (part?.inline_data?.data) {
        imageUrl = `data:${part.inline_data.mime_type || "image/png"};base64,${part.inline_data.data}`;
        break;
      }
    }
  }
  
  // Try OpenAI-compatible format from Google's OpenAI endpoint
  if (!imageUrl && typeof parts === "string") {
    // Check if there's base64 image data in the response
    const match = parts.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
    if (match) imageUrl = match[0];
  }
  
  if (!imageUrl) {
    const textContent = typeof parts === "string" ? parts : JSON.stringify(parts)?.slice(0, 200) || "";
    console.error("No image in response. Content:", textContent);
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
    const LOVABLE_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!LOVABLE_API_KEY) throw { status: 500, message: "Google Gemini API key not configured" };

    const body = await req.json();
    const { action } = body;
    console.log(`Processing action: ${action}`);

    let imageUrl: string;

    if (action === "blend-face") {
      const { faceImage, mannequinImage, gender, imageWidth, imageHeight } = body;
      console.log("Face image length:", faceImage?.length || 0, "Mannequin length:", mannequinImage?.length || 0, "Dimensions:", imageWidth, "x", imageHeight);
      
      const prompt = `You are an expert 3D mannequin renderer. I'm giving you two images:
1. First image: A smooth, off-white/cream colored store mannequin doll figure with a featureless head
2. Second image: A real person's face photo

Your task: Create a MANNEQUIN-STYLE version of this person's face and place it on the mannequin body.

CRITICAL RULES:
- Do NOT paste the real photo onto the mannequin. Instead, RENDER the face in the same smooth, matte, off-white/cream plastic mannequin style as the body
- The face should look like a SCULPTED mannequin version of the person - same facial structure, hair shape, but rendered as smooth plastic/resin material
- UNIFORM SKIN COLOR: The ENTIRE mannequin body (face, neck, torso, arms, hands, legs, feet) MUST be ONE single uniform off-white/cream color with absolutely NO patches, blotches, spots, streaks, or color variation. The skin must look like it was molded from a single piece of smooth plastic. Do NOT add any darker or lighter spots anywhere.
- The face should have the same matte, non-reflective finish as the body
- EYES: Give the mannequin REALISTIC PAINTED EYES matching the person's actual eye color. Colored irises, dark pupils, and subtle painted eyelashes.
- LIPS: Keep the lips the same smooth, matte, off-white/cream color as the rest of the mannequin skin. Do NOT add any color to the lips.
- Scale the head proportionally to the mannequin body size
- Hair should be rendered as a sculpted mannequin-style hair piece matching the person's EXACT hairstyle AND HAIR COLOR.
- Keep the mannequin's body, pose, underwear/clothing, and background completely unchanged

DIMENSION & FRAMING RULES (CRITICAL - FOLLOW EXACTLY):
- OUTPUT IMAGE MUST be EXACTLY ${imageWidth || 800} pixels wide and ${imageHeight || 1200} pixels tall
- The mannequin must be framed IDENTICALLY to the input: full body visible from the top of the head to the bottom of the feet
- The mannequin should be CENTERED horizontally in the frame
- Maintain the EXACT same scale/zoom as the input — do NOT zoom in, do NOT crop, do NOT reframe
- Leave the same amount of space above the head and below the feet as in the input
- BACKGROUND: Solid flat color #d5d3d0 (RGB 213, 211, 208) everywhere. No gradients, no shadows, no variation.`;

      imageUrl = await callAI(LOVABLE_API_KEY, [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: mannequinImage } },
          { type: "image_url", image_url: { url: faceImage } },
        ],
      }]);

    } else if (action === "reshape-body") {
      const { mannequinImage, gender, proportions, imageWidth, imageHeight } = body;
      const { height, chest, waist, hips, legs } = proportions;
      const avgH = gender === "female" ? 163 : 175;
      const avgC = gender === "female" ? 90 : 96;
      const avgW = gender === "female" ? 70 : 80;
      const avgHp = gender === "female" ? 100 : 98;
      const avgL = gender === "female" ? 76 : 82;
      const hPct = Math.round((height / avgH) * 100);
      const cPct = Math.round((chest / avgC) * 100);
      const wPct = Math.round((waist / avgW) * 100);
      const hpPct = Math.round((hips / avgHp) * 100);
      const lPct = Math.round((legs / avgL) * 100);
      const prompt = `Edit this mannequin/doll image to adjust body proportions to match these measurements:
- Height: ${height}cm (${hPct}% of average — ${hPct > 100 ? "taller" : hPct < 100 ? "shorter" : "average"})
- Chest: ${chest}cm (${cPct}% — ${cPct > 100 ? "wider chest" : cPct < 100 ? "narrower chest" : "average"})
- Waist: ${waist}cm (${wPct}% — ${wPct > 100 ? "wider waist" : wPct < 100 ? "narrower waist" : "average"})
- Hips: ${hips}cm (${hpPct}% — ${hpPct > 100 ? "wider hips" : hpPct < 100 ? "narrower hips" : "average"})
- Inseam/Legs: ${legs}cm (${lPct}% — ${lPct > 100 ? "longer legs" : lPct < 100 ? "shorter legs" : "average"})
Keep the same style, pose, clothing, and skin color. Only adjust the body proportions naturally. The mannequin is ${gender === "female" ? "female wearing white athletic top and shorts" : "male wearing white underwear"}.

DIMENSION & FRAMING RULES (CRITICAL - FOLLOW EXACTLY):
- OUTPUT IMAGE MUST be EXACTLY ${imageWidth || 800} pixels wide and ${imageHeight || 1200} pixels tall
- The mannequin must be framed IDENTICALLY to the input: full body visible from the top of the head to the bottom of the feet
- The mannequin should be CENTERED horizontally in the frame
- Maintain the EXACT same scale/zoom as the input — do NOT zoom in, do NOT crop, do NOT reframe
- Leave the same amount of space above the head and below the feet as in the input
- BACKGROUND: Solid flat color #d5d3d0 (RGB 213, 211, 208) everywhere. No gradients, no shadows, no variation.`;
      
      imageUrl = await callAI(LOVABLE_API_KEY, [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: mannequinImage } },
        ],
      }]);

    } else if (action === "try-on") {
      const { mannequinImage, productImageUrl, gender, imageWidth, imageHeight } = body;
      console.log("Try-on with product image length:", productImageUrl?.length || 0, "Dimensions:", imageWidth, "x", imageHeight);

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
- The final image should look like a real photo of someone wearing this clothing

DIMENSION & FRAMING RULES (CRITICAL - FOLLOW EXACTLY):
- OUTPUT IMAGE MUST be EXACTLY ${imageWidth || 800} pixels wide and ${imageHeight || 1200} pixels tall
- The mannequin must be framed IDENTICALLY to the input mannequin image: full body visible from the top of the head to the bottom of the feet
- The mannequin should be CENTERED horizontally in the frame
- Maintain the EXACT same scale/zoom as the input — do NOT zoom in on the clothing area, do NOT crop, do NOT reframe
- Leave the same amount of space above the head and below the feet as in the input
- BACKGROUND: Solid flat color #d5d3d0 (RGB 213, 211, 208) everywhere. No gradients, no shadows, no variation.`;

      imageUrl = await callAI(LOVABLE_API_KEY, [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: mannequinImage } },
          { type: "image_url", image_url: { url: productImageUrl } },
        ],
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
