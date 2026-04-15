CREATE OR REPLACE FUNCTION public.find_elder_by_phone(p_phone text)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH normalized_input AS (
    SELECT CASE
      WHEN p_phone IS NULL OR btrim(p_phone) = '' THEN NULL
      ELSE regexp_replace(
        CASE
          WHEN regexp_replace(p_phone, '\\D', '', 'g') LIKE '358%' THEN '0' || substr(regexp_replace(p_phone, '\\D', '', 'g'), 4)
          WHEN regexp_replace(p_phone, '\\D', '', 'g') LIKE '00358%' THEN '0' || substr(regexp_replace(p_phone, '\\D', '', 'g'), 6)
          WHEN regexp_replace(p_phone, '\\D', '', 'g') LIKE '0%' THEN regexp_replace(p_phone, '\\D', '', 'g')
          ELSE regexp_replace(p_phone, '\\D', '', 'g')
        END,
        '\\D', '', 'g'
      )
    END AS normalized_phone
  )
  SELECT e.id, e.full_name
  FROM public.elders e
  CROSS JOIN normalized_input ni
  WHERE ni.normalized_phone IS NOT NULL
    AND regexp_replace(
      CASE
        WHEN regexp_replace(e.phone_number, '\\D', '', 'g') LIKE '358%' THEN '0' || substr(regexp_replace(e.phone_number, '\\D', '', 'g'), 4)
        WHEN regexp_replace(e.phone_number, '\\D', '', 'g') LIKE '00358%' THEN '0' || substr(regexp_replace(e.phone_number, '\\D', '', 'g'), 6)
        WHEN regexp_replace(e.phone_number, '\\D', '', 'g') LIKE '0%' THEN regexp_replace(e.phone_number, '\\D', '', 'g')
        ELSE regexp_replace(e.phone_number, '\\D', '', 'g')
      END,
      '\\D', '', 'g'
    ) = ni.normalized_phone
  LIMIT 1;
$$;