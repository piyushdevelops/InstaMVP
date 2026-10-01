begin;
-- gen_random_uuid() is built into PostgreSQL 13+ / Supabase.
create table public.participants (
 id uuid primary key default gen_random_uuid(), campaign text not null default 'june-2027-v1',
 name text not null check(length(name) between 1 and 60), email text, phone text,
 contact_hash text not null, session_hash text not null unique,
 referral_code text not null unique, joined boolean not null default false,
 consent_version text not null default 'campaign-v1', consent_at timestamptz not null default now(),
 attribution jsonb not null default '{}', created_at timestamptz not null default now(),
 unique(campaign,contact_hash)
);
create unique index participants_email_unique on public.participants(campaign,lower(email)) where email is not null;
create unique index participants_phone_unique on public.participants(campaign,phone) where phone is not null;
create table public.votes (participant_id uuid references public.participants on delete cascade, cover_id text not null, liked boolean not null, created_at timestamptz not null default now(), primary key(participant_id,cover_id));
create table public.coupons (
 id uuid primary key default gen_random_uuid(),participant_id uuid not null unique references public.participants on delete cascade,
 code text not null unique,amount_paise integer not null default 50000 check(amount_paise=50000), currency text not null default 'INR',
 status text not null default 'pending' check(status in ('pending','active','redeemed','expired','revoked')),
 usage_limit integer not null default 1 check(usage_limit=1),shopify_discount_id text,redeemed_order_id text unique,expires_at timestamptz,created_at timestamptz default now()
);
create table public.referrals (
 id uuid primary key default gen_random_uuid(),referrer_id uuid not null references public.participants,
 participant_id uuid not null unique references public.participants,created_at timestamptz not null default now(),
 check(referrer_id<>participant_id)
);
create table public.referral_events (
 id uuid primary key default gen_random_uuid(),referrer_id uuid not null references public.participants,
 visitor_hash text not null,event_type text not null check(event_type in ('click','completion')),created_at timestamptz not null default now(),
 unique(referrer_id,visitor_hash,event_type)
);
create table public.orders (
 id text primary key, participant_id uuid references public.participants,shop_domain text not null,
 currency text not null default 'INR',eligible_subtotal_paise bigint not null default 0 check(eligible_subtotal_paise>=0),
 paid_at timestamptz,delivered_at timestamptz,cancelled_at timestamptz,refunded_at timestamptz,return_window_ends_at timestamptz,
 is_cod boolean not null default false,identity_verified boolean not null default false,risk_approved boolean not null default false,
 canonical_updated_at timestamptz,created_at timestamptz not null default now()
);
create table public.referral_credits (
 id uuid primary key default gen_random_uuid(),order_id text not null unique references public.orders,
 referrer_id uuid not null references public.participants,amount_paise bigint not null check(amount_paise>0),
 status text not null default 'pending' check(status in ('pending','approved','reversed')),
 reason text,approved_at timestamptz,reversed_at timestamptz,created_at timestamptz not null default now()
);
create table public.webhook_inbox (
 id text primary key, topic text not null,payload jsonb not null,status text not null default 'pending' check(status in ('pending','processing','done','failed')),
 attempts integer not null default 0,next_attempt_at timestamptz default now(),last_error text,received_at timestamptz not null default now()
);
create table public.rate_limits (bucket_key text primary key,hits integer not null,window_start timestamptz not null);
create index referrals_referrer_idx on public.referrals(referrer_id);
create index referral_events_referrer_idx on public.referral_events(referrer_id,event_type);
create index referral_credits_referrer_idx on public.referral_credits(referrer_id,status);
create index webhook_pending_idx on public.webhook_inbox(status,next_attempt_at);

create function public.register_participant(p jsonb) returns void language plpgsql set search_path=public as $$
declare pid uuid := (p->>'id')::uuid; rid uuid; v jsonb;
begin
 -- The server validates the configured cover IDs. Keep registration atomic.
 if jsonb_array_length(p->'votes')<>12 or (select count(distinct value->>'coverId') from jsonb_array_elements(p->'votes'))<>12 then raise exception 'Invalid ballot'; end if;
 if exists(select 1 from participants where session_hash=p->>'sessionHash') then return; end if;
 insert into participants(id,name,email,phone,contact_hash,session_hash,referral_code,attribution)
 values(pid,p->>'name',nullif(p->>'email',''),nullif(p->>'phone',''),p->>'contactHash',p->>'sessionHash',p->>'referralCode',p->'attribution');
 for v in select value from jsonb_array_elements(p->'votes') loop
 insert into votes(participant_id,cover_id,liked) values(pid,v->>'coverId',(v->>'liked')::boolean); end loop;
 insert into coupons(participant_id,code) values(pid,p->>'coupon');
 select id into rid from participants where referral_code=p->'attribution'->>'ref' and joined=true and id<>pid;
 if rid is not null then
 insert into referrals(referrer_id,participant_id) values(rid,pid);
 insert into referral_events(referrer_id,visitor_hash,event_type) values(rid,p->>'sessionHash','completion') on conflict do nothing;
 end if;
end $$;

create function public.record_referral_click(ref_code text,visitor_hash text) returns void language sql set search_path=public as $$
 insert into referral_events(referrer_id,visitor_hash,event_type)
 select id,visitor_hash,'click' from participants where referral_code=ref_code and joined=true and session_hash<>visitor_hash
 on conflict do nothing;
$$;
create function public.participant_dashboard(session_hash text) returns jsonb language sql stable set search_path=public as $$
 select jsonb_build_object('name',p.name,'coupon',c.code,'couponStatus','pending','referralCode',p.referral_code,'joined',p.joined,'mode','supabase','sampleStats',null,
 'stats',jsonb_build_object('clicks',(select count(*) from referral_events where referrer_id=p.id and event_type='click'),
 'completions',(select count(*) from referrals where referrer_id=p.id),
 'conversions',(select count(*) from referral_credits where referrer_id=p.id and status='approved'),
 'credits',coalesce((select sum(amount_paise)/100.0 from referral_credits where referrer_id=p.id and status='approved'),0)))
 from participants p join coupons c on c.participant_id=p.id where p.session_hash=participant_dashboard.session_hash;
$$;
create function public.consume_rate_limit(bucket_key text) returns boolean language plpgsql set search_path=public as $$
declare count_now integer;
begin
 insert into rate_limits as r values(bucket_key,1,now()) on conflict on constraint rate_limits_pkey do update set
 hits=case when r.window_start<now()-interval '1 minute' then 1 else r.hits+1 end,
 window_start=case when r.window_start<now()-interval '1 minute' then now() else r.window_start end returning hits into count_now;
 return count_now<=60;
end $$;

-- Worker-only gate; all canonical facts must already be verified by a trusted worker.
create function public.settle_order_credit(order_key text,credit_paise bigint) returns text language plpgsql set search_path=public as $$
declare o orders; rid uuid; existing_state text;
begin
 select * into o from orders where id=order_key for update;
 if not found then raise exception 'Unknown order'; end if;
 select status into existing_state from referral_credits where order_id=order_key;
 if o.cancelled_at is not null or o.refunded_at is not null then
 update referral_credits set status='reversed',reversed_at=now(),reason='Cancelled or refunded' where order_id=order_key;
 return 'reversed'; end if;
 if existing_state='reversed' then return 'reversed'; end if;
 if o.currency<>'INR' or o.eligible_subtotal_paise<=0 then return 'ineligible'; end if;
 if o.paid_at is null or o.delivered_at is null or not o.identity_verified or not o.risk_approved or o.return_window_ends_at is null or o.return_window_ends_at>now() then return 'hold'; end if;
 if credit_paise<=0 or credit_paise>o.eligible_subtotal_paise then raise exception 'Invalid credit amount'; end if;
 select referrer_id into rid from referrals where participant_id=o.participant_id;
 if rid is null or rid=o.participant_id then return 'unattributed'; end if;
 insert into referral_credits(order_id,referrer_id,amount_paise,status,approved_at)
 values(order_key,rid,credit_paise,'approved',now()) on conflict(order_id) do update set status='approved',approved_at=coalesce(referral_credits.approved_at,now()) where referral_credits.status='pending';
 return 'approved';
end $$;

-- Only the server service role may access data. No public participant lookups.
do $$ declare t text; begin foreach t in array array['participants','votes','coupons','referrals','referral_events','orders','referral_credits','webhook_inbox','rate_limits'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop; end $$;
revoke all on function public.register_participant(jsonb),public.record_referral_click(text,text),public.participant_dashboard(text),public.consume_rate_limit(text) from public,anon,authenticated;
grant execute on function public.register_participant(jsonb),public.record_referral_click(text,text),public.participant_dashboard(text),public.consume_rate_limit(text) to service_role;
revoke all on function public.settle_order_credit(text,bigint) from public,anon,authenticated;
grant execute on function public.settle_order_credit(text,bigint) to service_role;
commit;
