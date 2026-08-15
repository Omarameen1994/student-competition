-- =====================================================================
-- تسجيل المشرفَين — يُنفَّذ بعد إنشاء حسابَي Auth من لوحة Supabase
-- =====================================================================
-- الخطوات:
--   1) في Supabase: Authentication → Users → Add user
--      أنشئ حسابين، مثلًا:
--        admin1@example.com
--        admin2@example.com
--      وفعّل "Auto Confirm User".
--   2) نفّذ هذا الملف في SQL Editor بعد تعديل البريدَين والاسمين.
-- =====================================================================

insert into supervisors (id, name)
select id, 'المشرف الأول'
from auth.users
where email = 'admin1@example.com'
on conflict (id) do update set name = excluded.name;

insert into supervisors (id, name)
select id, 'المشرف الثاني'
from auth.users
where email = 'admin2@example.com'
on conflict (id) do update set name = excluded.name;

-- للتأكد:
select s.id, s.name, u.email
from supervisors s
join auth.users u on u.id = s.id;
