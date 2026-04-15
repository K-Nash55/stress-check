-- ============================================================
-- 職業性ストレス簡易調査票 Supabase スキーマ
-- Supabase SQL Editor で上から順に実行してください
-- ============================================================

-- pgcrypto（トークン生成に使用）
create extension if not exists pgcrypto;


-- ============================================================
-- 1. テーブル作成
-- ============================================================

-- 会社
create table public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

-- 管理者（Supabase Auth と連携）
create table public.admin_users (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id)
);

-- 招待URL
create table public.survey_links (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  token       text unique not null default encode(gen_random_bytes(16), 'hex'),
  department  text,                         -- 部署名（任意）
  is_active   boolean not null default true,
  expires_at  timestamptz,                  -- null = 無期限
  created_at  timestamptz default now()
);

-- 従業員（URLから自己登録）
create table public.employees (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  survey_link_id  uuid references public.survey_links(id),
  name            text not null,
  department      text,                     -- survey_links.department から引き継ぐ
  created_at      timestamptz default now()
);

-- 調査回答
create table public.survey_responses (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees(id) on delete cascade,
  company_id   uuid not null references public.companies(id) on delete cascade,
  answers      jsonb not null,              -- {"1":3, "2":1, ...} 質問番号→選択値(1-4)
  stress_level text check (stress_level in ('low', 'mid', 'high')),
  s_total      int,   s_max int,            -- ストレッサー
  r_total      int,   r_max int,            -- リソース
  o_total      int,   o_max int,            -- アウトカム
  completed_at timestamptz default now()
);


-- ============================================================
-- 2. RLS 有効化
-- ============================================================

alter table public.companies       enable row level security;
alter table public.admin_users     enable row level security;
alter table public.survey_links    enable row level security;
alter table public.employees       enable row level security;
alter table public.survey_responses enable row level security;


-- ============================================================
-- 3. ヘルパー関数（管理者の company_id を返す）
-- ============================================================

create or replace function public.my_company_id()
returns uuid language sql stable security definer as $$
  select company_id from public.admin_users where user_id = auth.uid() limit 1;
$$;


-- ============================================================
-- 4. RLS ポリシー
-- ============================================================

-- companies: 自社のみ参照・更新可
create policy "admin_select_company" on public.companies
  for select using (id = public.my_company_id());
create policy "admin_update_company" on public.companies
  for update using (id = public.my_company_id());

-- admin_users: 自分のレコードのみ参照可
create policy "admin_select_self" on public.admin_users
  for select using (user_id = auth.uid());

-- survey_links:
--   管理者 → 自社リンクをすべて操作可
--   匿名   → アクティブなリンクを token で参照可（従業員登録時）
create policy "admin_all_links" on public.survey_links
  for all using (company_id = public.my_company_id());
create policy "anon_select_active_link" on public.survey_links
  for select using (is_active = true);

-- employees:
--   誰でも INSERT 可（従業員が自己登録）
--   管理者 → 自社従業員を参照可
create policy "anyone_insert_employee" on public.employees
  for insert with check (true);
create policy "admin_select_employees" on public.employees
  for select using (company_id = public.my_company_id());

-- survey_responses:
--   誰でも INSERT 可（回答送信）
--   管理者 → 自社の回答を参照可
create policy "anyone_insert_response" on public.survey_responses
  for insert with check (true);
create policy "admin_select_responses" on public.survey_responses
  for select using (company_id = public.my_company_id());


-- ============================================================
-- 5. 初期セットアップ用ヘルパー関数
--    管理者が初回ログイン後にフロントエンドから呼び出す
--    company_name を渡すと companies + admin_users を作成して返す
-- ============================================================

create or replace function public.setup_company(company_name text)
returns uuid language plpgsql security definer as $$
declare
  cid uuid;
begin
  -- すでに会社が紐づいていたら何もしない
  select company_id into cid from public.admin_users where user_id = auth.uid();
  if cid is not null then
    return cid;
  end if;

  insert into public.companies (name) values (company_name) returning id into cid;
  insert into public.admin_users (user_id, company_id) values (auth.uid(), cid);
  return cid;
end;
$$;


-- ============================================================
-- 完了メッセージ
-- ============================================================
-- すべて正常に実行されると以下のテーブルが作成されます:
--   public.companies
--   public.admin_users
--   public.survey_links
--   public.employees
--   public.survey_responses
-- および関数:
--   public.my_company_id()
--   public.setup_company(text)
