-- =====================================================================
-- منصة مسابقات الطلاب عن بُعد — المخطط الأساسي
-- Live Team Competition Platform — core schema
-- =====================================================================
-- قاعدة أساسية: قاعدة البيانات هي المصدر الوحيد للحقيقة (القسم 36).
-- المتصفح لا يحسب نقاطًا ولا يحدد أول ضاغط ولا يفتح قدرة.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1) المشرفون
-- ---------------------------------------------------------------------
create table if not exists supervisors (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create or replace function is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from supervisors s where s.id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 2) البطولات
-- ---------------------------------------------------------------------
-- الحالات: draft | ready | live | paused | team_stage_finished | knockout | finished
create table if not exists competitions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  event_date   date,
  status       text not null default 'draft',
  is_demo      boolean not null default false,
  settings     jsonb not null default '{}'::jsonb,
  created_by   uuid references supervisors(id) on delete set null,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,
  constraint competitions_status_chk check (status in
    ('draft','ready','live','paused','team_stage_finished','knockout','finished'))
);

-- كل قيمة قابلة للتعديل من لوحة المشرف (القسم 60) — لا شيء Hard-coded.
create or replace function default_settings()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'question_seconds',          15,      -- مدة السؤال الافتراضية
    'default_points',            10,      -- قيمة السؤال الافتراضية
    'answer_seconds',            20,      -- الوقت المتاح للإجابة بعد الضغط
    'break_seconds',             5,       -- استراحة بين الأسئلة
    'teams_count',               2,
    'distribution',              'auto',  -- auto | manual
    'knockout_seeding',          'ranked',-- ranked | random
    'knockout_odd_handling',     'bye',   -- bye | play_in
    'tiebreaker',                'sudden_death',
    'show_student_points',       true,    -- عرض نقاط الطلاب لبعضهم
    'show_student_names',        true,
    'buzzer_enabled',            true,
    'allow_retry',               true,    -- إعادة فتح الـBuzzer بعد إجابة خاطئة
    'max_attempts_per_question', 3,
    'wrong_answer_penalty',      0,       -- خصم عند الخطأ (0 = بدون خصم)
    'sounds_enabled',            true,
    'single_device_per_code',    true     -- منع استخدام الكود من جهازين
  );
$$;

alter table competitions alter column settings set default default_settings();

-- ---------------------------------------------------------------------
-- 3) الفرق
-- ---------------------------------------------------------------------
create table if not exists teams (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  name           text not null,
  color          text not null default '#ef4444',
  emoji          text not null default '🔴',
  logo_url       text,
  score          integer not null default 0,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists teams_competition_idx on teams(competition_id);

-- ---------------------------------------------------------------------
-- 4) الطلاب
-- ---------------------------------------------------------------------
-- ملاحظة أمنية: هذا الجدول مقروء للجميع (للترتيب المباشر)، ولذلك
-- لا يحتوي على كود الدخول إطلاقًا. الأكواد في student_credentials.
create table if not exists students (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  team_id        uuid references teams(id) on delete set null,
  name           text not null,
  is_captain     boolean not null default false,
  points         integer not null default 0,
  correct_count  integer not null default 0,
  wrong_count    integer not null default 0,
  buzz_count     integer not null default 0,
  total_reaction_ms bigint not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists students_competition_idx on students(competition_id);
create index if not exists students_team_idx on students(team_id);

-- قائد واحد فقط لكل فريق
create unique index if not exists students_one_captain_per_team
  on students(team_id) where is_captain;

-- أكواد الدخول — لا يصل إليها إلا المشرف أو الخادم
create table if not exists student_credentials (
  student_id   uuid primary key references students(id) on delete cascade,
  login_code   text not null unique,
  enabled      boolean not null default true,
  device_id    text,                -- لمنع الدخول من أكثر من جهاز
  session_epoch integer not null default 1,  -- زيادته تُبطل الجلسات القديمة (طرد الجهاز)
  last_seen_at timestamptz
);

-- توليد كود قصير وواضح، بلا رموز مربكة (0/O و 1/I) — القسم 4
create or replace function generate_login_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRTUVWXYZ';
  candidate text;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..5 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from student_credentials c where c.login_code = candidate);
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) الأسئلة
-- ---------------------------------------------------------------------
-- يحتوي على الإجابة الصحيحة ⇒ ممنوع تمامًا على الطلاب.
create table if not exists questions (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  order_index    integer not null default 0,
  type           text not null default 'oral',
  text           text not null,
  media_url      text,
  correct_answer text,
  points         integer not null default 10,
  time_limit     integer not null default 15,   -- بالثواني
  is_golden      boolean not null default false,
  asked          boolean not null default false,
  created_at     timestamptz not null default now(),
  constraint questions_type_chk check (type in
    ('multiple_choice','true_false','short_answer','oral','image','audio','video'))
);
create index if not exists questions_competition_idx on questions(competition_id, order_index);

create table if not exists question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  label       text not null,
  is_correct  boolean not null default false,
  order_index integer not null default 0
);
create index if not exists question_options_question_idx on question_options(question_id);

-- ---------------------------------------------------------------------
-- 6) جلسة السؤال (كل مرة يُطرح فيها السؤال)
-- ---------------------------------------------------------------------
-- الحالات: running | awaiting_judgement | paused | closed | cancelled
create table if not exists question_sessions (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  question_id    uuid not null references questions(id) on delete cascade,
  status         text not null default 'running',
  started_at     timestamptz not null default now(),
  ends_at        timestamptz not null,
  paused_at      timestamptz,
  buzzer_open    boolean not null default true,
  locked_buzz_id uuid,
  blocked_student_ids uuid[] not null default '{}',
  attempts       integer not null default 0,
  closed_at      timestamptz,
  constraint question_sessions_status_chk check (status in
    ('running','awaiting_judgement','paused','closed','cancelled'))
);
create index if not exists question_sessions_competition_idx
  on question_sessions(competition_id, started_at desc);

-- ---------------------------------------------------------------------
-- 7) الـBuzzer
-- ---------------------------------------------------------------------
-- وقت الضغط يُسجَّل على الخادم فقط (القسم 49).
create table if not exists buzzes (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references question_sessions(id) on delete cascade,
  question_id  uuid not null references questions(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,
  team_id      uuid references teams(id) on delete set null,
  server_ts    timestamptz not null default clock_timestamp(),
  reaction_ms  integer not null,
  order_index  integer not null,
  status       text not null default 'pending',   -- pending | correct | wrong | cancelled
  constraint buzzes_status_chk check (status in ('pending','correct','wrong','cancelled'))
);
-- طالب واحد = ضغطة واحدة لكل جلسة سؤال (القسم 37)
create unique index if not exists buzzes_one_per_student_per_session
  on buzzes(session_id, student_id);
create index if not exists buzzes_session_idx on buzzes(session_id, order_index);

-- إجابة الطالب — يراها المشرف فقط قبل الحكم
create table if not exists answers (
  id           uuid primary key default gen_random_uuid(),
  buzz_id      uuid not null unique references buzzes(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,
  text         text not null default '',
  option_id    uuid references question_options(id) on delete set null,
  submitted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 8) سجل النقاط
-- ---------------------------------------------------------------------
create table if not exists score_events (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  team_id        uuid references teams(id) on delete cascade,
  student_id     uuid references students(id) on delete cascade,
  question_id    uuid references questions(id) on delete set null,
  team_delta     integer not null default 0,
  student_delta  integer not null default 0,
  reason         text not null,
  created_by     uuid references supervisors(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists score_events_competition_idx
  on score_events(competition_id, created_at desc);

-- ---------------------------------------------------------------------
-- 9) القدرات الخاصة
-- ---------------------------------------------------------------------
create table if not exists powerups (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  key            text not null,             -- double | skip | shield | ...
  name           text not null,
  description    text not null default '',
  icon           text not null default '⚡',
  unlock_points  integer not null default 100,
  max_uses       integer not null default 1,
  requires_approval boolean not null default true,
  applies_to     text not null default 'next',   -- next | current
  enabled        boolean not null default true,
  sort_order     integer not null default 0,
  unique (competition_id, key)
);

-- حالة القدرة لكل فريق
create table if not exists team_powerups (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  powerup_id  uuid not null references powerups(id) on delete cascade,
  uses_left   integer not null default 1,
  unlocked    boolean not null default false,
  armed       boolean not null default false,   -- مفعَّلة وتنتظر تطبيقها
  used_count  integer not null default 0,
  unique (team_id, powerup_id)
);

create table if not exists powerup_requests (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  team_id        uuid not null references teams(id) on delete cascade,
  powerup_id     uuid not null references powerups(id) on delete cascade,
  requested_by   uuid not null references students(id) on delete cascade,
  status         text not null default 'pending',  -- pending | approved | rejected
  decided_by     uuid references supervisors(id) on delete set null,
  decided_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists powerup_requests_pending_idx
  on powerup_requests(competition_id, status);

-- ---------------------------------------------------------------------
-- 10) خروج المغلوب
-- ---------------------------------------------------------------------
create table if not exists rounds (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  name           text not null,
  round_index    integer not null,
  status         text not null default 'pending',  -- pending | active | finished
  unique (competition_id, round_index)
);

create table if not exists matches (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references rounds(id) on delete cascade,
  match_index  integer not null,
  student_a    uuid references students(id) on delete set null,
  student_b    uuid references students(id) on delete set null,
  winner_id    uuid references students(id) on delete set null,
  is_bye       boolean not null default false,
  status       text not null default 'pending',   -- pending | live | finished
  next_match_id uuid references matches(id) on delete set null,
  next_slot    text,                              -- a | b
  decided_at   timestamptz,
  unique (round_id, match_index)
);
create index if not exists matches_round_idx on matches(round_id, match_index);

-- ---------------------------------------------------------------------
-- 11) سجل الأحداث (القسم 21) — للمشرفين فقط
-- ---------------------------------------------------------------------
create table if not exists events (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  actor_type     text not null default 'system',  -- system | supervisor | student
  actor_name     text,
  type           text not null,
  message        text not null,
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists events_competition_idx
  on events(competition_id, created_at desc);

-- ---------------------------------------------------------------------
-- 12) الحالة المباشرة — ما يراه الطلاب
-- ---------------------------------------------------------------------
-- هذا الجدول هو القناة الوحيدة التي يقرأ منها الطالب حالة السؤال،
-- ويحتوي على نسخة *منقّاة* من السؤال بدون الإجابة الصحيحة.
create table if not exists competition_state (
  competition_id   uuid primary key references competitions(id) on delete cascade,
  phase            text not null default 'idle',   -- idle | question | judging | break | knockout | finished
  session_id       uuid references question_sessions(id) on delete set null,
  question_public  jsonb,        -- { number, text, type, media_url, options[], points, ends_at }
  buzzer_open      boolean not null default false,
  first_buzz       jsonb,        -- { student_id, student_name, team_id, team_name, reaction_ms }
  banner           text,
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 13) الترتيب المباشر (Views)
-- ---------------------------------------------------------------------
create or replace view team_standings as
select
  t.id, t.competition_id, t.name, t.color, t.emoji, t.score,
  rank() over (partition by t.competition_id order by t.score desc, t.name) as rank
from teams t;

create or replace view student_standings as
select
  s.id, s.competition_id, s.team_id, s.name, s.points, s.is_captain,
  s.correct_count, s.wrong_count, s.buzz_count,
  case when s.buzz_count > 0 then s.total_reaction_ms / s.buzz_count else null end as avg_reaction_ms,
  rank() over (partition by s.competition_id order by s.points desc, s.name) as overall_rank,
  rank() over (partition by s.team_id       order by s.points desc, s.name) as team_rank
from students s;

-- =====================================================================
-- الدوال الحرجة — كلها ذرّية (atomic) لمنع التنفيذ المزدوج
-- =====================================================================

-- ---------------------------------------------------------------------
-- press_buzzer — أول ضغطة فقط تفوز، والوقت من ساعة الخادم (القسم 49)
-- ---------------------------------------------------------------------
create or replace function press_buzzer(p_student uuid, p_session uuid)
returns jsonb
language plpgsql
as $$
declare
  sess     question_sessions%rowtype;
  stu      students%rowtype;
  team     teams%rowtype;
  new_buzz buzzes%rowtype;
  now_ts   timestamptz := clock_timestamp();
  next_idx integer;
begin
  -- قفل صف الجلسة يسلسل كل الضغطات المتزامنة على الخادم
  select * into sess from question_sessions where id = p_session for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'session_not_found');
  end if;

  if sess.status <> 'running' or not sess.buzzer_open then
    return jsonb_build_object('ok', false, 'error', 'buzzer_closed');
  end if;

  if now_ts > sess.ends_at then
    return jsonb_build_object('ok', false, 'error', 'time_up');
  end if;

  if p_student = any(sess.blocked_student_ids) then
    return jsonb_build_object('ok', false, 'error', 'already_answered');
  end if;

  select * into stu from students where id = p_student and active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'student_not_active');
  end if;

  if exists (select 1 from buzzes b where b.session_id = p_session and b.student_id = p_student) then
    return jsonb_build_object('ok', false, 'error', 'already_buzzed');
  end if;

  select coalesce(max(order_index), 0) + 1 into next_idx from buzzes where session_id = p_session;

  insert into buzzes (session_id, question_id, student_id, team_id, server_ts, reaction_ms, order_index)
  values (
    p_session, sess.question_id, p_student, stu.team_id, now_ts,
    greatest(0, extract(epoch from (now_ts - sess.started_at)) * 1000)::int,
    next_idx
  )
  returning * into new_buzz;

  -- قفل الـBuzzer فورًا حتى يحكم المشرف (القسم 10)
  update question_sessions
     set buzzer_open = false,
         locked_buzz_id = new_buzz.id,
         status = 'awaiting_judgement',
         attempts = attempts + 1
   where id = p_session;

  update students
     set buzz_count = buzz_count + 1,
         total_reaction_ms = total_reaction_ms + new_buzz.reaction_ms
   where id = p_student;

  select * into team from teams where id = stu.team_id;

  update competition_state
     set phase = 'judging',
         buzzer_open = false,
         first_buzz = jsonb_build_object(
           'buzz_id',     new_buzz.id,
           'student_id',  stu.id,
           'student_name',stu.name,
           'team_id',     team.id,
           'team_name',   team.name,
           'team_emoji',  team.emoji,
           'team_color',  team.color,
           'reaction_ms', new_buzz.reaction_ms
         ),
         updated_at = now()
   where competition_id = sess.competition_id;

  insert into events (competition_id, actor_type, actor_name, type, message, payload)
  values (sess.competition_id, 'student', stu.name, 'buzz',
          stu.name || ' ضغط Buzzer',
          jsonb_build_object('reaction_ms', new_buzz.reaction_ms, 'buzz_id', new_buzz.id));

  return jsonb_build_object('ok', true, 'buzz_id', new_buzz.id, 'reaction_ms', new_buzz.reaction_ms);
end;
$$;

-- ---------------------------------------------------------------------
-- judge_buzz — حكم المشرف. ذرّي وغير قابل للتنفيذ مرتين (القسم 20)
-- ---------------------------------------------------------------------
create or replace function judge_buzz(p_buzz uuid, p_verdict text, p_supervisor uuid)
returns jsonb
language plpgsql
as $$
declare
  bz        buzzes%rowtype;
  sess      question_sessions%rowtype;
  q         questions%rowtype;
  stu       students%rowtype;
  sup_name  text;
  multiplier integer := 1;
  awarded   integer;
  penalty   integer;
  v_tp      team_powerups%rowtype;
  v_settings jsonb;
  reopened  boolean := false;
begin
  select * into bz from buzzes where id = p_buzz for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'buzz_not_found');
  end if;

  -- الحماية من الضغط المزدوج من المشرفَين في نفس اللحظة
  if bz.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'already_judged', 'status', bz.status);
  end if;

  select * into sess from question_sessions where id = bz.session_id for update;
  select * into q    from questions         where id = bz.question_id;
  select * into stu  from students          where id = bz.student_id;
  select c.settings into v_settings from competitions c where c.id = sess.competition_id;
  select s.name into sup_name from supervisors s where s.id = p_supervisor;

  if p_verdict = 'correct' then
    -- هل للفريق قدرة مضاعفة مفعّلة؟
    select x.* into v_tp
      from team_powerups x
      join powerups p on p.id = x.powerup_id
     where x.team_id = bz.team_id and x.armed and p.key = 'double'
     limit 1;
    if found then
      multiplier := 2;
      update team_powerups
         set armed = false, uses_left = greatest(0, uses_left - 1), used_count = used_count + 1
       where id = v_tp.id;
    end if;

    awarded := q.points * multiplier;

    update buzzes set status = 'correct' where id = bz.id;
    update teams    set score  = score  + awarded where id = bz.team_id;
    update students set points = points + awarded, correct_count = correct_count + 1
     where id = bz.student_id;

    insert into score_events (competition_id, team_id, student_id, question_id,
                              team_delta, student_delta, reason, created_by)
    values (sess.competition_id, bz.team_id, bz.student_id, bz.question_id,
            awarded, awarded,
            case when multiplier > 1 then 'إجابة صحيحة ×2' else 'إجابة صحيحة' end,
            p_supervisor);

    update question_sessions
       set status = 'closed', buzzer_open = false, closed_at = now()
     where id = sess.id;
    update questions set asked = true where id = q.id;

    update competition_state
       set phase = 'break', buzzer_open = false, updated_at = now()
     where competition_id = sess.competition_id;

    insert into events (competition_id, actor_type, actor_name, type, message, payload)
    values (sess.competition_id, 'supervisor', coalesce(sup_name,'مشرف'), 'judge_correct',
            'اعتُمدت إجابة ' || stu.name || ' صحيحة (+' || awarded || ')',
            jsonb_build_object('buzz_id', bz.id, 'points', awarded, 'multiplier', multiplier));

  elsif p_verdict = 'wrong' then
    penalty := coalesce((v_settings->>'wrong_answer_penalty')::int, 0);

    -- درع الحماية يلغي الخصم
    if penalty > 0 then
      select x.* into v_tp
        from team_powerups x
        join powerups p on p.id = x.powerup_id
       where x.team_id = bz.team_id and x.armed and p.key = 'shield'
       limit 1;
      if found then
        penalty := 0;
        update team_powerups
           set armed = false, uses_left = greatest(0, uses_left - 1), used_count = used_count + 1
         where id = v_tp.id;
      end if;
    end if;

    update buzzes set status = 'wrong' where id = bz.id;
    update students set wrong_count = wrong_count + 1, points = points - penalty
     where id = bz.student_id;
    if penalty > 0 then
      update teams set score = score - penalty where id = bz.team_id;
      insert into score_events (competition_id, team_id, student_id, question_id,
                                team_delta, student_delta, reason, created_by)
      values (sess.competition_id, bz.team_id, bz.student_id, bz.question_id,
              -penalty, -penalty, 'إجابة خاطئة', p_supervisor);
    end if;

    -- منع نفس الطالب من الضغط ثانية، وإعادة فتح الـBuzzer للبقية (القسم 13)
    reopened := coalesce((v_settings->>'allow_retry')::boolean, true)
                and sess.attempts < coalesce((v_settings->>'max_attempts_per_question')::int, 3)
                and clock_timestamp() < sess.ends_at;

    update question_sessions
       set blocked_student_ids = array_append(blocked_student_ids, bz.student_id),
           buzzer_open = reopened,
           locked_buzz_id = null,
           status = case when reopened then 'running' else 'closed' end,
           closed_at = case when reopened then null else now() end
     where id = sess.id;

    update competition_state
       set phase = case when reopened then 'question' else 'break' end,
           buzzer_open = reopened,
           first_buzz = null,
           updated_at = now()
     where competition_id = sess.competition_id;

    insert into events (competition_id, actor_type, actor_name, type, message, payload)
    values (sess.competition_id, 'supervisor', coalesce(sup_name,'مشرف'), 'judge_wrong',
            'اعتُمدت إجابة ' || stu.name || ' خاطئة',
            jsonb_build_object('buzz_id', bz.id, 'reopened', reopened, 'penalty', penalty));

  else
    return jsonb_build_object('ok', false, 'error', 'bad_verdict');
  end if;

  perform refresh_powerup_unlocks(sess.competition_id);

  return jsonb_build_object('ok', true, 'verdict', p_verdict,
                            'points', coalesce(awarded, 0), 'reopened', reopened);
end;
$$;

-- ---------------------------------------------------------------------
-- refresh_powerup_unlocks — فتح القدرات عند بلوغ النقاط (القسم 16)
-- ---------------------------------------------------------------------
create or replace function refresh_powerup_unlocks(p_competition uuid)
returns void
language plpgsql
as $$
declare
  r record;
begin
  for r in
    select tp.id, tp.unlocked, t.score, p.unlock_points, p.name, t.name as team_name, t.competition_id
      from team_powerups tp
      join teams    t on t.id = tp.team_id
      join powerups p on p.id = tp.powerup_id
     where t.competition_id = p_competition and p.enabled
  loop
    if not r.unlocked and r.score >= r.unlock_points then
      update team_powerups set unlocked = true where id = r.id;
      insert into events (competition_id, actor_type, type, message, payload)
      values (p_competition, 'system', 'powerup_unlocked',
              'فُتحت قدرة ' || r.name || ' لفريق ' || r.team_name,
              jsonb_build_object('team_powerup_id', r.id));
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- start_question — بدء سؤال ونشر نسخة منقّاة للطلاب
-- ---------------------------------------------------------------------
create or replace function start_question(p_question uuid, p_supervisor uuid, p_seconds integer default null)
returns jsonb
language plpgsql
as $$
declare
  q        questions%rowtype;
  secs     integer;
  sess     question_sessions%rowtype;
  opts     jsonb;
  qnum     integer;
  sup_name text;
begin
  select * into q from questions where id = p_question;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'question_not_found');
  end if;

  -- لا سؤالان في نفس الوقت
  update question_sessions
     set status = 'cancelled', closed_at = now()
   where competition_id = q.competition_id and status in ('running','awaiting_judgement','paused');

  secs := coalesce(p_seconds, q.time_limit);

  insert into question_sessions (competition_id, question_id, ends_at)
  values (q.competition_id, q.id, now() + make_interval(secs => secs))
  returning * into sess;

  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label) order by o.order_index), '[]'::jsonb)
    into opts
    from question_options o where o.question_id = q.id;

  select count(*) into qnum
    from questions x
   where x.competition_id = q.competition_id and x.order_index <= q.order_index;

  select name into sup_name from supervisors where id = p_supervisor;

  insert into competition_state (competition_id) values (q.competition_id)
  on conflict (competition_id) do nothing;

  update competition_state
     set phase = 'question',
         session_id = sess.id,
         buzzer_open = true,
         first_buzz = null,
         question_public = jsonb_build_object(
           'number',    qnum,
           'text',      q.text,
           'type',      q.type,
           'media_url', q.media_url,
           'options',   opts,
           'points',    q.points,
           'started_at',sess.started_at,
           'ends_at',   sess.ends_at,
           'seconds',   secs
         ),
         updated_at = now()
   where competition_id = q.competition_id;

  insert into events (competition_id, actor_type, actor_name, type, message, payload)
  values (q.competition_id, 'supervisor', coalesce(sup_name,'مشرف'), 'question_start',
          'بدأ السؤال رقم ' || qnum, jsonb_build_object('session_id', sess.id, 'seconds', secs));

  return jsonb_build_object('ok', true, 'session_id', sess.id, 'ends_at', sess.ends_at);
end;
$$;

-- ---------------------------------------------------------------------
-- التحكم في الوقت: إيقاف / استئناف / إعادة / إنهاء / إلغاء (القسم 14)
-- ---------------------------------------------------------------------
create or replace function control_question(p_session uuid, p_action text, p_supervisor uuid)
returns jsonb
language plpgsql
as $$
declare
  sess     question_sessions%rowtype;
  paused_ms bigint;
  sup_name text;
  secs     integer;
begin
  select * into sess from question_sessions where id = p_session for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'session_not_found');
  end if;
  select name into sup_name from supervisors where id = p_supervisor;

  if p_action = 'pause' then
    if sess.paused_at is not null then
      return jsonb_build_object('ok', true, 'noop', true);
    end if;
    update question_sessions set paused_at = now(), status = 'paused', buzzer_open = false
     where id = p_session;
    update competition_state set buzzer_open = false, phase = 'break', updated_at = now()
     where competition_id = sess.competition_id;

  elsif p_action = 'resume' then
    if sess.paused_at is null then
      return jsonb_build_object('ok', true, 'noop', true);
    end if;
    paused_ms := extract(epoch from (now() - sess.paused_at)) * 1000;
    update question_sessions
       set ends_at = ends_at + make_interval(secs => paused_ms / 1000.0),
           paused_at = null, status = 'running', buzzer_open = true
     where id = p_session
     returning * into sess;
    update competition_state
       set buzzer_open = true, phase = 'question',
           question_public = jsonb_set(question_public, '{ends_at}', to_jsonb(sess.ends_at)),
           updated_at = now()
     where competition_id = sess.competition_id;

  elsif p_action = 'reset' then
    select time_limit into secs from questions where id = sess.question_id;
    update question_sessions
       set started_at = now(), ends_at = now() + make_interval(secs => secs),
           paused_at = null, status = 'running', buzzer_open = true,
           blocked_student_ids = '{}', locked_buzz_id = null, attempts = 0
     where id = p_session
     returning * into sess;
    update buzzes set status = 'cancelled' where session_id = p_session and status = 'pending';
    update competition_state
       set buzzer_open = true, phase = 'question', first_buzz = null,
           question_public = jsonb_set(
             jsonb_set(question_public, '{ends_at}',    to_jsonb(sess.ends_at)),
                                        '{started_at}', to_jsonb(sess.started_at)),
           updated_at = now()
     where competition_id = sess.competition_id;

  elsif p_action in ('end','cancel') then
    update question_sessions
       set status = case when p_action = 'end' then 'closed' else 'cancelled' end,
           buzzer_open = false, closed_at = now()
     where id = p_session;
    update competition_state
       set phase = 'break', buzzer_open = false, first_buzz = null, updated_at = now()
     where competition_id = sess.competition_id;
    if p_action = 'end' then
      update questions set asked = true where id = sess.question_id;
    end if;

  elsif p_action = 'reopen' then
    update question_sessions
       set status = 'running', buzzer_open = true, locked_buzz_id = null
     where id = p_session;
    update competition_state
       set phase = 'question', buzzer_open = true, first_buzz = null, updated_at = now()
     where competition_id = sess.competition_id;

  else
    return jsonb_build_object('ok', false, 'error', 'bad_action');
  end if;

  insert into events (competition_id, actor_type, actor_name, type, message)
  values (sess.competition_id, 'supervisor', coalesce(sup_name,'مشرف'),
          'question_' || p_action, 'تحكّم في السؤال: ' || p_action);

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- decide_powerup — موافقة/رفض المشرف على طلب القائد (القسم 16)
-- ---------------------------------------------------------------------
create or replace function decide_powerup(p_request uuid, p_approve boolean, p_supervisor uuid)
returns jsonb
language plpgsql
as $$
declare
  req      powerup_requests%rowtype;
  tp       team_powerups%rowtype;
  pw       powerups%rowtype;
  sup_name text;
  sess_id  uuid;
begin
  select * into req from powerup_requests where id = p_request for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'request_not_found');
  end if;
  if req.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'already_decided');
  end if;

  select * into pw from powerups where id = req.powerup_id;
  select name into sup_name from supervisors where id = p_supervisor;

  update powerup_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = p_supervisor, decided_at = now()
   where id = p_request;

  if p_approve then
    select * into tp from team_powerups
     where team_id = req.team_id and powerup_id = req.powerup_id for update;

    if pw.key = 'skip' then
      -- تخطّي السؤال الحالي مباشرة
      update team_powerups
         set uses_left = greatest(0, tp.uses_left - 1), used_count = tp.used_count + 1, armed = false
       where id = tp.id;
      select session_id into sess_id from competition_state where competition_id = req.competition_id;
      if sess_id is not null then
        perform control_question(sess_id, 'cancel', p_supervisor);
      end if;
    else
      -- Double / Shield: تُسلَّح لتُطبَّق على السؤال القادم
      update team_powerups set armed = true where id = tp.id;
    end if;
  end if;

  insert into events (competition_id, actor_type, actor_name, type, message, payload)
  values (req.competition_id, 'supervisor', coalesce(sup_name,'مشرف'),
          case when p_approve then 'powerup_approved' else 'powerup_rejected' end,
          case when p_approve then 'وافق على ' else 'رفض ' end || pw.name,
          jsonb_build_object('request_id', p_request));

  return jsonb_build_object('ok', true, 'approved', p_approve);
end;
$$;

-- ---------------------------------------------------------------------
-- finish_team_stage — إنهاء مرحلة الفرق وتجهيز خروج المغلوب (القسم 25)
-- ---------------------------------------------------------------------
create or replace function finish_team_stage(p_competition uuid, p_supervisor uuid)
returns jsonb
language plpgsql
as $$
declare
  winner   teams%rowtype;
  sup_name text;
begin
  update question_sessions set status = 'closed', buzzer_open = false, closed_at = now()
   where competition_id = p_competition and status in ('running','awaiting_judgement','paused');

  select * into winner from teams
   where competition_id = p_competition
   order by score desc, name limit 1;

  update competitions set status = 'team_stage_finished' where id = p_competition;
  update competition_state
     set phase = 'break', buzzer_open = false, session_id = null,
         question_public = null, first_buzz = null,
         banner = 'انتهت مرحلة الفرق — الفائز: ' || coalesce(winner.name, '-'),
         updated_at = now()
   where competition_id = p_competition;

  select name into sup_name from supervisors where id = p_supervisor;
  insert into events (competition_id, actor_type, actor_name, type, message, payload)
  values (p_competition, 'supervisor', coalesce(sup_name,'مشرف'), 'team_stage_finished',
          'انتهت مرحلة الفرق. الفريق الفائز: ' || coalesce(winner.name,'-'),
          jsonb_build_object('winner_team_id', winner.id));

  return jsonb_build_object('ok', true, 'winner_team_id', winner.id, 'winner_team_name', winner.name);
end;
$$;

-- ---------------------------------------------------------------------
-- build_knockout — إنشاء شجرة خروج المغلوب تلقائيًا (الأقسام 26-30)
-- يتعامل مع العدد الفردي عبر Bye بدون أي خطأ (القسم 28)
-- ---------------------------------------------------------------------
create or replace function build_knockout(p_competition uuid, p_team uuid, p_seeding text default null)
returns jsonb
language plpgsql
as $$
declare
  seeding    text;
  ids        uuid[];
  n          integer;
  bracket    integer;   -- أقرب قوة للعدد 2 أكبر أو يساوي n
  byes       integer;
  rounds_cnt integer;
  r          integer;
  i          integer;
  round_id   uuid;
  prev_round uuid;
  m_count    integer;
  a_id       uuid;
  b_id       uuid;
  m_id       uuid;
  round_name text;
  v_settings jsonb;
  slots      uuid[];
begin
  select c.settings into v_settings from competitions c where c.id = p_competition;
  seeding := coalesce(p_seeding, v_settings->>'knockout_seeding', 'ranked');

  -- مسح أي شجرة سابقة
  delete from rounds where competition_id = p_competition;

  if seeding = 'random' then
    select array_agg(id order by random()) into ids
      from students where team_id = p_team and active;
  else
    select array_agg(id order by points desc, name) into ids
      from students where team_id = p_team and active;
  end if;

  n := coalesce(array_length(ids, 1), 0);
  if n < 2 then
    return jsonb_build_object('ok', false, 'error', 'not_enough_students', 'count', n);
  end if;

  bracket := 2;
  while bracket < n loop bracket := bracket * 2; end loop;
  byes := bracket - n;
  rounds_cnt := (ln(bracket) / ln(2))::int;

  -- ترتيب المقاعد: الأعلى مع الأدنى (#1 مع #n) حسب القسم 27،
  -- والمقاعد الفارغة (Bye) تذهب لأصحاب الترتيب الأعلى.
  slots := array_fill(null::uuid, array[bracket]);
  for i in 1..n loop
    slots[i] := ids[i];
  end loop;

  prev_round := null;
  for r in reverse rounds_cnt..1 loop
    m_count := power(2, r - 1)::int;
    round_name := case
      when r = 1 then 'النهائي'
      when r = 2 then 'نصف النهائي'
      when r = 3 then 'ربع النهائي'
      else 'دور الـ' || (m_count * 2)::text
    end;

    insert into rounds (competition_id, name, round_index)
    values (p_competition, round_name, r)
    returning id into round_id;

    for i in 1..m_count loop
      if r = rounds_cnt then
        -- الجولة الأولى: #1 ضد #bracket، #2 ضد #(bracket-1) ...
        a_id := slots[i];
        b_id := slots[bracket - i + 1];
      else
        a_id := null; b_id := null;
      end if;

      insert into matches (round_id, match_index, student_a, student_b, is_bye, status, winner_id)
      values (
        round_id, i, a_id, b_id,
        (r = rounds_cnt and (a_id is null or b_id is null)),
        case when r = rounds_cnt and (a_id is null or b_id is null) then 'finished' else 'pending' end,
        case when r = rounds_cnt and b_id is null then a_id
             when r = rounds_cnt and a_id is null then b_id
             else null end
      );
    end loop;

    prev_round := round_id;
  end loop;

  -- ربط كل مباراة بالمباراة التالية
  update matches m
     set next_match_id = nm.id,
         next_slot     = case when m.match_index % 2 = 1 then 'a' else 'b' end
    from rounds rr
    join rounds nr on nr.competition_id = rr.competition_id and nr.round_index = rr.round_index - 1
    join matches nm on nm.round_id = nr.id
   where m.round_id = rr.id
     and rr.competition_id = p_competition
     and nm.match_index = ceil(m.match_index / 2.0);

  -- ترقية الفائزين بالـBye مباشرة
  perform advance_byes(p_competition);

  update competitions   set status = 'knockout' where id = p_competition;
  update competition_state set phase = 'knockout', banner = 'مرحلة خروج المغلوب', updated_at = now()
   where competition_id = p_competition;

  insert into events (competition_id, actor_type, type, message, payload)
  values (p_competition, 'system', 'knockout_built',
          'أُنشئت شجرة خروج المغلوب لـ ' || n || ' طالبًا',
          jsonb_build_object('students', n, 'bracket', bracket, 'byes', byes, 'seeding', seeding));

  return jsonb_build_object('ok', true, 'students', n, 'bracket', bracket,
                            'byes', byes, 'rounds', rounds_cnt, 'seeding', seeding);
end;
$$;

create or replace function advance_byes(p_competition uuid)
returns void
language plpgsql
as $$
declare
  m record;
begin
  for m in
    select mt.* from matches mt
      join rounds r on r.id = mt.round_id
     where r.competition_id = p_competition
       and mt.status = 'finished' and mt.winner_id is not null
     order by r.round_index desc, mt.match_index
  loop
    if m.next_match_id is not null then
      if m.next_slot = 'a' then
        update matches set student_a = m.winner_id where id = m.next_match_id and student_a is null;
      else
        update matches set student_b = m.winner_id where id = m.next_match_id and student_b is null;
      end if;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- decide_match — اعتماد الفائز والترقية التلقائية (القسم 29)
-- ---------------------------------------------------------------------
create or replace function decide_match(p_match uuid, p_winner uuid, p_supervisor uuid)
returns jsonb
language plpgsql
as $$
declare
  m         matches%rowtype;
  r         rounds%rowtype;
  comp      uuid;
  sup_name  text;
  win_name  text;
  runner_up uuid;
  is_final  boolean;
begin
  select * into m from matches where id = p_match for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'match_not_found');
  end if;
  if m.status = 'finished' then
    return jsonb_build_object('ok', false, 'error', 'already_decided');
  end if;
  if p_winner is distinct from m.student_a and p_winner is distinct from m.student_b then
    return jsonb_build_object('ok', false, 'error', 'winner_not_in_match');
  end if;

  select * into r from rounds where id = m.round_id;
  comp := r.competition_id;
  select name into sup_name from supervisors where id = p_supervisor;
  select name into win_name from students   where id = p_winner;

  update matches set winner_id = p_winner, status = 'finished', decided_at = now()
   where id = p_match;

  if m.next_match_id is not null then
    if m.next_slot = 'a' then
      update matches set student_a = p_winner where id = m.next_match_id;
    else
      update matches set student_b = p_winner where id = m.next_match_id;
    end if;
  end if;

  is_final := (r.round_index = 1);
  if is_final then
    runner_up := case when p_winner = m.student_a then m.student_b else m.student_a end;
    update competitions set status = 'finished', finished_at = now() where id = comp;
    update competition_state
       set phase = 'finished',
           banner = '🏆 بطل البطولة: ' || win_name,
           updated_at = now()
     where competition_id = comp;
    insert into events (competition_id, actor_type, type, message, payload)
    values (comp, 'system', 'tournament_finished', 'انتهت البطولة. البطل: ' || win_name,
            jsonb_build_object('champion', p_winner, 'runner_up', runner_up));
  end if;

  insert into events (competition_id, actor_type, actor_name, type, message, payload)
  values (comp, 'supervisor', coalesce(sup_name,'مشرف'), 'match_decided',
          'فوز ' || win_name || ' في ' || r.name,
          jsonb_build_object('match_id', p_match, 'winner', p_winner));

  return jsonb_build_object('ok', true, 'winner', p_winner, 'is_final', is_final);
end;
$$;

-- ---------------------------------------------------------------------
-- adjust_points — منح أو خصم يدوي من المشرف (القسم 2)
-- ---------------------------------------------------------------------
create or replace function adjust_points(
  p_competition uuid, p_team uuid, p_student uuid,
  p_team_delta integer, p_student_delta integer,
  p_reason text, p_supervisor uuid
) returns jsonb
language plpgsql
as $$
declare sup_name text;
begin
  if p_team is not null and p_team_delta <> 0 then
    update teams set score = score + p_team_delta where id = p_team;
  end if;
  if p_student is not null and p_student_delta <> 0 then
    update students set points = points + p_student_delta where id = p_student;
  end if;

  insert into score_events (competition_id, team_id, student_id, team_delta, student_delta, reason, created_by)
  values (p_competition, p_team, p_student, p_team_delta, p_student_delta,
          coalesce(p_reason, 'تعديل يدوي'), p_supervisor);

  select name into sup_name from supervisors where id = p_supervisor;
  insert into events (competition_id, actor_type, actor_name, type, message, payload)
  values (p_competition, 'supervisor', coalesce(sup_name,'مشرف'), 'manual_adjust',
          'تعديل يدوي للنقاط', jsonb_build_object('team', p_team_delta, 'student', p_student_delta));

  perform refresh_powerup_unlocks(p_competition);
  return jsonb_build_object('ok', true);
end;
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
-- المبدأ: الطالب (anon) يقرأ فقط ما هو آمن للعرض، ولا يكتب شيئًا مباشرة.
-- كل كتابات الطالب تمر عبر خادم Next.js بمفتاح الخدمة بعد التحقق.
-- =====================================================================

alter table supervisors        enable row level security;
alter table competitions       enable row level security;
alter table teams              enable row level security;
alter table students           enable row level security;
alter table student_credentials enable row level security;
alter table questions          enable row level security;
alter table question_options   enable row level security;
alter table question_sessions  enable row level security;
alter table buzzes             enable row level security;
alter table answers            enable row level security;
alter table score_events       enable row level security;
alter table powerups           enable row level security;
alter table team_powerups      enable row level security;
alter table powerup_requests   enable row level security;
alter table rounds             enable row level security;
alter table matches            enable row level security;
alter table events             enable row level security;
alter table competition_state  enable row level security;

-- المشرف: صلاحية كاملة على كل شيء
do $$
declare t text;
begin
  foreach t in array array[
    'competitions','teams','students','student_credentials','questions','question_options',
    'question_sessions','buzzes','answers','score_events','powerups','team_powerups',
    'powerup_requests','rounds','matches','events','competition_state'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated using (is_supervisor()) with check (is_supervisor())',
      'supervisor_all_' || t, t);
  end loop;
end;
$$;

create policy supervisors_self_read on supervisors
  for select to authenticated using (id = auth.uid() or is_supervisor());

-- قراءة عامة آمنة (للطلاب وشاشة العرض)
create policy public_read_competitions on competitions for select to anon, authenticated using (true);
create policy public_read_teams        on teams        for select to anon, authenticated using (true);
create policy public_read_students     on students     for select to anon, authenticated using (true);
create policy public_read_state        on competition_state for select to anon, authenticated using (true);
create policy public_read_buzzes       on buzzes       for select to anon, authenticated using (true);
create policy public_read_powerups     on powerups     for select to anon, authenticated using (true);
create policy public_read_team_powerups on team_powerups for select to anon, authenticated using (true);
create policy public_read_powerup_reqs on powerup_requests for select to anon, authenticated using (true);
create policy public_read_rounds       on rounds       for select to anon, authenticated using (true);
create policy public_read_matches      on matches      for select to anon, authenticated using (true);

-- ممنوع على anon: questions, question_options, answers, student_credentials,
-- events, score_events, question_sessions  ← لا توجد سياسة select لهم أصلًا.

-- =====================================================================
-- Realtime
-- =====================================================================
do $$
declare t text;
begin
  -- answers / question_sessions محميّة بـRLS، فلا يصل إليها إلا المشرف
  foreach t in array array[
    'competition_state','teams','students','buzzes','team_powerups',
    'powerup_requests','matches','rounds','events','competitions',
    'answers','question_sessions'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end;
$$;
