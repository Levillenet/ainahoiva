CREATE OR REPLACE FUNCTION public.find_elder_by_phone(p_phone text)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name
  FROM elders
  WHERE replace(replace(replace(phone_number, ' ', ''), '-', ''), '(', '') 
      = replace(replace(replace(p_phone, ' ', ''), '-', ''), '(', '')
  LIMIT 1;
$$;