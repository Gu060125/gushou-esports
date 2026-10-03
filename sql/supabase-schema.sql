-- =====================================================================
-- 顾手游电竞 · 用户账号与即时聊天（Supabase 免费版）
-- 数据库结构 + 行级安全策略（RLS）+ 存储桶策略 + 实时订阅  一键脚本
-- ---------------------------------------------------------------------
-- 使用方式：
--   1. 打开 Supabase 控制台 → 左侧 SQL Editor → New query
--   2. 把本文件内容整段粘贴进去 → Run（可重复执行，脚本内已做幂等处理）
--   3. 依次完成：Authentication → Providers 开启 Email；
--      Authentication → URL Configuration 填入站点地址（详见部署说明）
-- ---------------------------------------------------------------------
-- 设计要点：
--   · 一对一聊天用 direct_key（两个 user_id 排序拼接）保证同一对用户只有一条会话
--   · 群聊由 conversations.type = 'group' 表示，成员关系全部落在 conversation_members
--   · 所有表开启 RLS，只允许"会话成员"读写自己会话的数据，任何人无法越权读取
--   · 图片走 Storage 私有桶 chat-images，路径 {conversation_id}/{user_id}/xxx.jpg
--   · 数据变化通过 Realtime 推送，客户端据此刷新会话列表与消息流
-- =====================================================================


-- =====================================================================
-- 1. 扩展与枚举
-- =====================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

do $$
begin
  if not exists (select 1 from pg_type where typname = 'conversation_type') then
    create type public.conversation_type as enum ('direct', 'group');
  end if;
end $$;


-- =====================================================================
-- 2. 表结构
-- =====================================================================

-- 2.1 用户资料（与 auth.users 一对一，注册时自动创建）
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_username_len check (char_length(btrim(username)) between 2 and 20)
);

comment on table  public.profiles is '用户资料：注册后由触发器自动写入，username 可用于搜索好友';
comment on column public.profiles.username is '登录名以外的展示用账号（2-20 字符，不区分大小写唯一）';

-- 2.2 会话（一对一 / 群聊）
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  type            public.conversation_type not null default 'direct',
  title           text,                       -- 群聊名称；一对一为空
  created_by      uuid references auth.users(id) on delete set null,
  direct_key      text unique,                -- 仅一对一使用：least(uid) || ':' || greatest(uid)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

comment on table public.conversations is '会话主体：一对一（direct）与群聊（group）共用一张表';

-- 2.3 会话成员
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'member' check (role in ('owner', 'member')),
  last_read_at    timestamptz not null default now(),   -- 用于计算未读数
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

comment on table public.conversation_members is '会话成员关系 + 已读位置（未读数由二者计算）';

-- 2.4 消息（文字 / 图片，不含视频）
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  body            text,                 -- 文字内容
  image_path      text,                 -- 图片在 chat-images 桶内的相对路径
  image_w         int,
  image_h         int,
  image_size      int,
  created_at      timestamptz not null default now(),
  constraint messages_payload_check check (
    coalesce(nullif(btrim(coalesce(body, '')), ''), '') <> '' or image_path is not null
  )
);

comment on table public.messages is '消息：文字与图片可单独或同时存在（不支持视频）';

-- 2.5 索引
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));
create index if not exists idx_messages_conv_time on public.messages (conversation_id, created_at desc);
create index if not exists idx_members_user        on public.conversation_members (user_id);
create index if not exists idx_conversations_last  on public.conversations (last_message_at desc);


-- =====================================================================
-- 3. 权限判定辅助函数（security definer，避免 RLS 互相递归）
-- =====================================================================

create or replace function public.is_conversation_member(p_conversation uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = p_conversation and m.user_id = p_user
  );
$$;

create or replace function public.is_conversation_owner(p_conversation uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = p_conversation and m.user_id = p_user and m.role = 'owner'
  );
$$;

-- 容错转换：Storage 策略里从路径解析 uuid，非法值返回 null 而不是报错
create or replace function public.safe_uuid(p_text text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end $$;


-- =====================================================================
-- 4. 触发器函数
-- =====================================================================

-- 4.1 注册后自动建资料（username 冲突时自动追加数字后缀）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_name text;
  v_i    int := 0;
begin
  v_base := btrim(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''),
                           split_part(coalesce(new.email, ''), '@', 1),
                           'user'));
  if char_length(v_base) < 2 then
    v_base := 'user';
  end if;
  v_base := left(v_base, 16);
  v_name := v_base;

  while exists (select 1 from public.profiles p where lower(p.username) = lower(v_name)) loop
    v_i := v_i + 1;
    v_name := v_base || v_i::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, v_name,
          coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), v_name))
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4.2 updated_at 自动维护
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_conversations_updated on public.conversations;
create trigger trg_conversations_updated
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- 4.3 新消息 → 刷新会话活跃时间 + 发送者已读位置
--     用 security definer 是为了绕过 conversations 的"仅群主可改"策略
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;

  update public.conversation_members
     set last_read_at = new.created_at
   where conversation_id = new.conversation_id
     and user_id = new.sender_id;

  return new;
end $$;

drop trigger if exists trg_message_touch on public.messages;
create trigger trg_message_touch
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();


-- =====================================================================
-- 5. 行级安全策略（RLS）
-- =====================================================================

alter table public.profiles            enable row level security;
alter table public.conversations       enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages            enable row level security;

-- 5.1 profiles：登录用户可查所有资料（用于搜索好友），只能改自己
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- 5.2 conversations：成员可见；群主可改名；成员可建群
drop policy if exists conversations_select_member on public.conversations;
create policy conversations_select_member on public.conversations
  for select to authenticated using (public.is_conversation_member(id));

drop policy if exists conversations_insert_self on public.conversations;
create policy conversations_insert_self on public.conversations
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists conversations_update_owner on public.conversations;
create policy conversations_update_owner on public.conversations
  for update to authenticated
  using (public.is_conversation_owner(id))
  with check (public.is_conversation_owner(id));

drop policy if exists conversations_delete_owner on public.conversations;
create policy conversations_delete_owner on public.conversations
  for delete to authenticated using (public.is_conversation_owner(id));

-- 5.3 conversation_members：成员可见；群主可拉人/踢人；本人可更新已读、可退群
drop policy if exists members_select_member on public.conversation_members;
create policy members_select_member on public.conversation_members
  for select to authenticated using (public.is_conversation_member(conversation_id));

drop policy if exists members_insert_owner on public.conversation_members;
create policy members_insert_owner on public.conversation_members
  for insert to authenticated with check (public.is_conversation_owner(conversation_id));

drop policy if exists members_update_self on public.conversation_members;
create policy members_update_self on public.conversation_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists members_delete_self_or_owner on public.conversation_members;
create policy members_delete_self_or_owner on public.conversation_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_conversation_owner(conversation_id));

-- 5.4 messages：仅会话成员可读写；只能以自己的身份发消息
drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages
  for select to authenticated using (public.is_conversation_member(conversation_id));

drop policy if exists messages_insert_member_self on public.messages;
create policy messages_insert_member_self on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));

drop policy if exists messages_update_self on public.messages;
create policy messages_update_self on public.messages
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

drop policy if exists messages_delete_self_or_owner on public.messages;
create policy messages_delete_self_or_owner on public.messages
  for delete to authenticated
  using (sender_id = auth.uid() or public.is_conversation_owner(conversation_id));


-- =====================================================================
-- 6. 会话列表视图（客户端一次查询即可拿到会话 + 最后一条消息 + 未读数）
--    security_invoker：视图按当前登录用户的 RLS 权限取数
-- =====================================================================

drop view if exists public.conversation_overview;
create view public.conversation_overview
with (security_invoker = true)
as
select
  c.id,
  c.type,
  c.title,
  c.created_by,
  c.created_at,
  c.updated_at,
  c.last_message_at,
  m.last_read_at,
  -- 未读数：对方发的、晚于自己上次已读时间的消息
  (select count(*)
     from public.messages msg
    where msg.conversation_id = c.id
      and msg.created_at > m.last_read_at
      and msg.sender_id <> auth.uid()) as unread_count,
  -- 最后一条消息
  (select json_build_object(
            'id', msg.id, 'sender_id', msg.sender_id, 'body', msg.body,
            'image_path', msg.image_path, 'created_at', msg.created_at)
     from public.messages msg
    where msg.conversation_id = c.id
    order by msg.created_at desc
    limit 1) as last_message,
  -- 成员 id 列表
  (select coalesce(json_agg(cm2.user_id), '[]'::json)
     from public.conversation_members cm2
    where cm2.conversation_id = c.id) as member_ids,
  -- 一对一的对方资料
  (select json_build_object(
            'id', p.id, 'username', p.username,
            'display_name', p.display_name, 'avatar_url', p.avatar_url)
     from public.conversation_members cm3
     join public.profiles p on p.id = cm3.user_id
    where cm3.conversation_id = c.id
      and cm3.user_id <> auth.uid()
    limit 1) as peer,
  -- 群聊成员资料（用于头像堆叠与成员列表）
  (select coalesce(json_agg(json_build_object(
            'id', p.id, 'username', p.username,
            'display_name', p.display_name, 'avatar_url', p.avatar_url, 'role', cm4.role)
          order by cm4.joined_at), '[]'::json)
     from public.conversation_members cm4
     join public.profiles p on p.id = cm4.user_id
    where cm4.conversation_id = c.id) as member_profiles
from public.conversations c
join public.conversation_members m
  on m.conversation_id = c.id and m.user_id = auth.uid();


-- =====================================================================
-- 7. 业务 RPC（走 security definer，内部自带越权校验）
-- =====================================================================

-- 7.1 打开/创建一对一会话（幂等：同一对用户永远返回同一个会话 id）
create or replace function public.create_direct_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me  uuid := auth.uid();
  v_key text;
  v_id  uuid;
begin
  if v_me is null then
    raise exception '未登录';
  end if;
  if p_other is null or p_other = v_me then
    raise exception '聊天对象无效';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_other) then
    raise exception '对方账号不存在';
  end if;

  v_key := least(v_me::text, p_other::text) || ':' || greatest(v_me::text, p_other::text);

  insert into public.conversations (type, created_by, direct_key)
  values ('direct', v_me, v_key)
  on conflict (direct_key) do update set updated_at = public.conversations.updated_at
  returning id into v_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_id, v_me, 'member'), (v_id, p_other, 'member')
  on conflict (conversation_id, user_id) do nothing;

  return v_id;
end $$;

-- 7.2 创建群聊
create or replace function public.create_group_conversation(p_title text, p_members uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   uuid := auth.uid();
  v_id   uuid;
  v_ids  uuid[];
begin
  if v_me is null then
    raise exception '未登录';
  end if;

  v_ids := array(
    select distinct x
      from unnest(coalesce(p_members, array[]::uuid[])) as x
     where x is not null
       and x <> v_me
       and exists (select 1 from public.profiles p where p.id = x)
  );

  if coalesce(array_length(v_ids, 1), 0) < 1 then
    raise exception '至少选择一位成员';
  end if;

  insert into public.conversations (type, title, created_by)
  values ('group', coalesce(nullif(btrim(coalesce(p_title, '')), ''), '群聊'), v_me)
  returning id into v_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  select v_id, u, case when u = v_me then 'owner' else 'member' end
    from unnest(v_ids || v_me) as u
  on conflict (conversation_id, user_id) do nothing;

  return v_id;
end $$;

-- 7.3 群主拉人
create or replace function public.add_group_members(p_conversation uuid, p_members uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_count int  := 0;
begin
  if v_me is null then
    raise exception '未登录';
  end if;
  if not public.is_conversation_owner(p_conversation, v_me) then
    raise exception '只有群主可以添加成员';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  select p_conversation, x, 'member'
    from unnest(coalesce(p_members, array[]::uuid[])) as x
   where x is not null
     and x <> v_me
     and exists (select 1 from public.profiles p where p.id = x)
  on conflict (conversation_id, user_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- 7.4 退出群聊（一对一不删除，避免对方会话消失）
create or replace function public.leave_conversation(p_conversation uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_type public.conversation_type;
begin
  if v_me is null then
    raise exception '未登录';
  end if;

  select type into v_type from public.conversations where id = p_conversation;
  if v_type is null then
    raise exception '会话不存在';
  end if;
  if v_type <> 'group' then
    raise exception '一对一聊天不能退出，可直接删除会话记录';
  end if;

  delete from public.conversation_members
   where conversation_id = p_conversation and user_id = v_me;

  return true;
end $$;


-- =====================================================================
-- 8. Storage：图片私有桶 chat-images
--    路径规范：{conversation_id}/{user_id}/{时间戳}-{随机}.jpg
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 上传：只能传到"自己加入的会话"目录下，且必须是自己的 user_id 子目录
drop policy if exists chat_images_insert on storage.objects;
create policy chat_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and public.safe_uuid((storage.foldername(name))[1]) is not null
    and public.is_conversation_member(public.safe_uuid((storage.foldername(name))[1]))
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- 读取：只有该会话成员可以读（客户端用 createSignedUrls 拿临时地址）
drop policy if exists chat_images_select on storage.objects;
create policy chat_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and public.safe_uuid((storage.foldername(name))[1]) is not null
    and public.is_conversation_member(public.safe_uuid((storage.foldername(name))[1]))
  );

-- 删除：只能删自己上传的图片
drop policy if exists chat_images_delete on storage.objects;
create policy chat_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = auth.uid()::text
  );


-- =====================================================================
-- 9. Realtime：把三张表加入实时发布，客户端才能收到推送
-- =====================================================================

alter table public.messages             replica identity full;
alter table public.conversations        replica identity full;
alter table public.conversation_members replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;

  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_members') then
    alter publication supabase_realtime add table public.conversation_members;
  end if;
end $$;


-- =====================================================================
-- 10. 冒烟测试（按需手工执行，正式使用可忽略）
-- =====================================================================
-- 10.1 两个测试账号注册并登录后，A 执行：
--   select public.create_direct_conversation('<B 的 user id>');
-- 10.2 用返回的会话 id 发一条消息：
--   insert into public.messages (conversation_id, sender_id, body)
--   values ('<会话 id>', auth.uid(), '联调测试消息');
-- 10.3 查看会话列表（应能看到未读数与最后一条消息）：
--   select id, type, title, unread_count, last_message from public.conversation_overview;
-- 10.4 越权校验（用第三个账号执行，应返回 0 行）：
--   select * from public.messages where conversation_id = '<会话 id>';
-- =====================================================================
-- 脚本结束
-- =====================================================================
