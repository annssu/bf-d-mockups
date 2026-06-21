-- =========================================================================
-- 베프디(BF.D) 3기 지원자 테이블 만들기
-- -------------------------------------------------------------------------
-- ▶ 해니가 할 일:
--   1) Supabase 대시보드 접속  →  왼쪽 메뉴 "SQL Editor" 클릭
--   2) "New query" 누르고, 아래 내용을 전부 복사해서 붙여넣으세요
--   3) 오른쪽 아래 초록색 "Run" 버튼 클릭 → 끝!
--
--   (한 번만 실행하면 돼요. 이미 만들어져 있으면 그냥 통과하니 다시 눌러도 안전해요.)
-- =========================================================================

create table if not exists applications_s3 (
  id              bigint generated always as identity primary key,
  created_at      timestamptz default now(),

  -- 필수 항목 (비어 있으면 저장이 안 돼요)
  name            text not null,        -- 이름
  phone           text not null,        -- 전화번호
  email           text not null,        -- 이메일
  github          text not null,        -- GitHub 아이디

  -- 선택/추가 항목
  role            text,                 -- 직무
  years_exp       text,                 -- 연차
  ai_level        text,                 -- AI 사용 빈도
  team            text,                 -- 지원하고 싶은 팀
  referral        text,                 -- 유입 경로 (어떻게 알게 됐는지)
  reason          text,                 -- 지원 동기 (주관식)

  -- 동의 항목 (체크 안 하면 false)
  consent_privacy boolean default false,  -- 개인정보 수집·이용 동의
  consent_content boolean default false   -- 콘텐츠·사진 활용 동의
);

-- 저장은 서버 함수(/api/apply)가 service_role 키로 처리하므로,
-- 외부(브라우저)에서 직접 접근하지 못하도록 RLS(행 보안)를 켜둬요.
-- service_role 키는 RLS를 우회하므로 서버 함수 저장에는 영향이 없어요.
alter table applications_s3 enable row level security;
