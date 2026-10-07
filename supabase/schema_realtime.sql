-- ==============================================================================
-- Your Factory メカニック・車両整備・パーツクラフト管理システム
-- Supabase リアルタイム同期 & 全履歴永続化 スキーマ
-- ==============================================================================

-- 1. 全パーツ・整備メニュー・素材マスタ (factory_items)
create table if not exists public.factory_items (
  id text primary key,
  code text,
  name text not null,
  type text not null check (type in ('product', 'ingredient')),
  shop_id text default 'factory',
  unit text not null default '個',
  current_stock numeric not null default 0,
  optimal_stock numeric default 10,
  alert_threshold numeric default 3,
  cost_price numeric default 0,
  selling_price numeric not null default 0,
  category_id text,
  category_name text,
  image_url text,
  recipe jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. 売上・整備伝票 (factory_sales)
create table if not exists public.factory_sales (
  id text primary key,
  shop_id text not null default 'factory',
  staff_name text not null,
  staff_user_id text,
  total_amount numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  payment_method text default 'cash',
  notes text,
  created_at timestamptz default now()
);

-- 3. 全操作履歴・監査ログ (factory_action_logs)
create table if not exists public.factory_action_logs (
  id text primary key,
  user_name text not null,
  user_role text not null default 'staff',
  category text not null,
  title text not null,
  detail text not null,
  created_at timestamptz default now()
);

-- 4. システム共通状態 (factory_system_state) - 金庫残高、週次ボーナス、役職、ユーザー等
create table if not exists public.factory_system_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- ==============================================================================
-- 行レベルセキュリティ (RLS) の有効化 & 全権限ポリシー
-- ==============================================================================
alter table public.factory_items enable row level security;
alter table public.factory_sales enable row level security;
alter table public.factory_action_logs enable row level security;
alter table public.factory_system_state enable row level security;

-- 匿名キー(anon)からの全権限許可ポリシー (誰でもリアルタイム読み書き可能)
create policy "Allow all operations for factory_items" on public.factory_items for all using (true) with check (true);
create policy "Allow all operations for factory_sales" on public.factory_sales for all using (true) with check (true);
create policy "Allow all operations for factory_action_logs" on public.factory_action_logs for all using (true) with check (true);
create policy "Allow all operations for factory_system_state" on public.factory_system_state for all using (true) with check (true);

-- ==============================================================================
-- リアルタイム パブリケーションの登録 (WebSocket通知の有効化)
-- ==============================================================================
begin;
  -- publication が存在しない場合のみ安全に追加
  drop publication if exists supabase_realtime;
  create publication supabase_realtime for table 
    public.factory_items, 
    public.factory_sales, 
    public.factory_action_logs, 
    public.factory_system_state;
commit;
