import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { action, faceImage, mannequinImage, gender, proportions } = await req.json();

    let prompt = "";
    const messages: any[] = [];

    if (action === "blend-face") {
      prompt = `Take the mannequin/doll image and seamlessly blend the person's face from the second image onto the mannequin's head. Make it look natural and realistic - match skin tones, lighting, and proportions. The face should look like it belongs on the mannequin body. Keep the mannequin's body, pose, and clothing exactly the same. Only replace the head/face area.`;

      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: mannequinImage },
          },
          {
            type: "image_url",
            image_url: { url: faceImage },
          },
        ],
      });
    } else if (action === "reshape-body") {
      const { height, chest, hips, legs } = proportions;
      prompt = `Edit this mannequin/doll image to adjust body proportions: 
- Overall height scale: ${height}% (${height > 100 ? "taller" : height < 100 ? "shorter" : "normal"})
- Chest/torso width: ${chest}% (${chest > 100 ? "wider chest" : chest < 100 ? "narrower chest" : "normal"})
- Hip width: ${hips}% (${hips > 100 ? "wider hips" : hips < 100 ? "narrower hips" : "normal"})
- Leg length: ${legs}% (${legs > 100 ? "longer legs" : legs < 100 ? "shorter legs" : "normal"})

Keep the same style, pose, clothing, skin color, and background. Only adjust the body proportions naturally. The mannequin is ${gender === "female" ? "female wearing white athletic top and shorts" : "male wearing white underwear"}.`;

      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: mannequinImage },
          },
        ],
      });
    } else {
      throw new Error("Invalid action");
    }

    console.log(`Processing ${action} request...`);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image in response:", JSON.stringify(data).slice(0, 500));
      throw new Error("AI did not return an image");
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-mannequin error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
