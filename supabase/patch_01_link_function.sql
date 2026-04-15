-- ============================================================
-- patch_01: 招待リンク情報取得用 RPC
-- register.html から呼び出す（anon ユーザーが company_name を取得できるよう security definer）
-- schema.sql 実行後にこのファイルも SQL Editor で実行してください
-- ============================================================

create or replace function public.get_link_by_token(p_token text)
returns table (
  link_id      uuid,
  company_id   uuid,
  company_name text,
  department   text,
  is_active    boolean,
  expires_at   timestamptz
)
language sql security definer as $$
  select
    sl.id,
    sl.company_id,
    c.name as company_name,
    sl.department,
    sl.is_active,
    sl.expires_at
  from public.survey_links sl
  join public.companies c on c.id = sl.company_id
  where sl.token = p_token
  limit 1;
$$;
