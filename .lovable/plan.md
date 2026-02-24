

## Plan: Seamless Background with Full-Body Display

### Problem
Switching from `object-cover` to `object-contain` will show the full body (no cropping), but it may reveal gaps between the image background and the container background, breaking the professional look.

### Solution
Two coordinated changes to ensure seamlessness:

### 1. Frontend: Switch to `object-contain` (TryOnViewer.tsx)
- Change the mannequin `img` class from `object-cover object-center` to `object-contain`
- The container background is already set to `#d5d3d0` which will fill any gaps

### 2. AI Prompts: Enforce matching background color (Edge Function)
- Update **all three prompts** (blend-face, reshape-body, try-on) to explicitly instruct the AI to:
  - Use a **solid `#d5d3d0` background** (the exact hex matching the container)
  - Maintain the **exact same full-body framing** (head to feet, same zoom/crop)
  - Keep the **same image dimensions** as the input
- This ensures every AI-generated image has a background that perfectly matches the container, so `object-contain` padding areas are invisible

### Files Changed

| File | Change |
|------|--------|
| `src/components/TryOnViewer.tsx` | `object-cover object-center` to `object-contain` on mannequin img |
| `supabase/functions/process-mannequin/index.ts` | Add background color (`#d5d3d0`) and full-body framing instructions to all 3 prompts |

### Why This Works
When `object-contain` leaves space around the image, that space shows the container's `#d5d3d0` background. Since the AI is told to use exactly that same color, the transition is invisible -- no seams, no visible container edges.

