/* =========================================================================
   BF.D 웨잇리스트 — 신청 저장 설정
   -------------------------------------------------------------------------
   이 파일 하나만 고치면 두 디자인(A안·B안) 둘 다 똑같이 적용돼요.

   ▶ 지금은 "demo" 모드라서 신청을 눌러도 저장은 안 되고 "완료!" 화면만 떠요.
     (디자인 미리보기용)

   ▶ 진짜로 신청을 받으려면 아래 MODE를 바꾸세요. 둘 중 하나만 고르면 돼요:

   ───────────────────────────────────────────────
   방법 ① Formspree (제일 쉬움, 5분, 코딩 0)
   ───────────────────────────────────────────────
   1) https://formspree.io 가입 (구글 계정으로 바로 가능)
   2) New form → 폼 이름 아무거나 → 만들면 주소가 나와요:
        https://formspree.io/f/abcwxyz   ← 이런 모양
   3) 아래 MODE 를 "formspree" 로 바꾸고
      FORMSPREE_ENDPOINT 에 그 주소를 붙여넣기
   → 끝! 신청이 들어오면 가입한 이메일로 알림이 오고,
     Formspree 대시보드에서 명단도 볼 수 있어요. (무료 월 50건)

   ───────────────────────────────────────────────
   방법 ② Supabase (이미 쓰는 베프디 DB에 쌓고 싶을 때)
   ───────────────────────────────────────────────
   1) Supabase 대시보드 → SQL Editor 에 아래 붙여넣고 실행:

        create table if not exists waitlist (
          id bigint generated always as identity primary key,
          created_at timestamptz default now(),
          name text, phone text, reason text, linkedin text, source text
        );
        alter table waitlist enable row level security;
        create policy "anyone can insert" on waitlist
          for insert to anon with check (true);

   2) Settings → API 에서 "Project URL" 과 "anon public" 키를 복사
      (anon 키는 외부에 공개돼도 안전한 키예요)
   3) 아래 MODE 를 "supabase" 로 바꾸고 URL/KEY 채우기
   ========================================================================= */

const WAITLIST_CONFIG = {
  // "demo" | "formspree" | "supabase"
  MODE: "demo",

  // 방법 ① Formspree
  FORMSPREE_ENDPOINT: "https://formspree.io/f/여기에_본인_폼ID",

  // 방법 ② Supabase
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // 완료 화면에 보여줄 "대기 순번" 시작 숫자(seed).
  // 첫 신청자도 텅 비어 보이지 않게, 47번부터 시작하는 효과.
  // 실제 저장(supabase) 연결 시 = 이 숫자 + 진짜 누적 인원으로 자동 계산돼요.
  WAITLIST_START_NUMBER: 47,
};

/* ===== 여기 아래는 건드리지 않아도 돼요 ===================================== */

(function () {
  const form = document.getElementById("wl-form");
  if (!form) return;
  const doneEl = document.getElementById("wl-done");
  const errEl = document.getElementById("wl-error");
  const btn = document.getElementById("wl-submit");

  function showError(msg) {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.classList.remove("hidden");
  }
  function showDone(position) {
    form.classList.add("hidden");
    if (errEl) errEl.classList.add("hidden");
    const posEl = document.getElementById("wl-position");
    if (posEl && position) posEl.textContent = position.toLocaleString();
    if (doneEl) { doneEl.classList.remove("hidden"); doneEl.classList.add("flex"); }
  }

  // 미리보기(demo)용 순번: 이 브라우저 기준으로 seed부터 하나씩 증가
  function demoPosition() {
    var key = "bfd_wl_idx";
    var idx = parseInt(localStorage.getItem(key) || "0", 10);
    localStorage.setItem(key, String(idx + 1));
    return WAITLIST_CONFIG.WAITLIST_START_NUMBER + idx;
  }

  function collect() {
    const fd = new FormData(form);
    const reason = fd.get("reason") === "기타"
      ? "기타: " + (fd.get("reason_etc") || "").toString().trim()
      : (fd.get("reason") || "").toString();
    return {
      name: (fd.get("name") || "").toString().trim(),
      phone: (fd.get("phone") || "").toString().trim(),
      reason,
      linkedin: (fd.get("linkedin") || "").toString().trim(),
      source: document.title || "BF.D waitlist",
    };
  }

  async function submitFormspree(data) {
    const res = await fetch(WAITLIST_CONFIG.FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Formspree 응답 오류 " + res.status);
  }

  async function submitSupabase(data) {
    const res = await fetch(WAITLIST_CONFIG.SUPABASE_URL + "/rest/v1/waitlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: WAITLIST_CONFIG.SUPABASE_ANON_KEY,
        Authorization: "Bearer " + WAITLIST_CONFIG.SUPABASE_ANON_KEY,
        Prefer: "return=minimal,count=exact",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Supabase 응답 오류 " + res.status);
    // 응답 헤더의 누적 건수(예: "0-0/123") → 순번 계산. 첫 신청자가 정확히 seed로 보이게 -1.
    var total = parseInt((res.headers.get("content-range") || "").split("/")[1], 10);
    if (!isNaN(total) && total > 0) return WAITLIST_CONFIG.WAITLIST_START_NUMBER + total - 1;
    return WAITLIST_CONFIG.WAITLIST_START_NUMBER;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (errEl) errEl.classList.add("hidden");
    const data = collect();

    if (WAITLIST_CONFIG.MODE === "demo") { showDone(demoPosition()); return; }

    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "등록 중…"; }
    try {
      var position = WAITLIST_CONFIG.WAITLIST_START_NUMBER;
      if (WAITLIST_CONFIG.MODE === "formspree") { await submitFormspree(data); position = demoPosition(); }
      else if (WAITLIST_CONFIG.MODE === "supabase") position = await submitSupabase(data);
      else throw new Error("MODE 설정이 올바르지 않아요: " + WAITLIST_CONFIG.MODE);
      showDone(position);
    } catch (err) {
      console.error(err);
      showError("등록 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || "웨잇리스트 등록하기"; }
    }
  });
})();
