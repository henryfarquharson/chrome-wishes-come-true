CREATE TABLE public.closet_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_image TEXT NOT NULL,
  result_image TEXT NOT NULL,
  product_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.closet_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own closet items" ON public.closet_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own closet items" ON public.closet_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own closet items" ON public.closet_items FOR DELETE USING (auth.uid() = user_id);
