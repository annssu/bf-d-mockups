// =========================================================================
// BF.D 3기 지원서 — 신청 저장 서버 함수 (Vercel Serverless Function)
// -------------------------------------------------------------------------
// 3기 지원 폼이 이 주소(/api/apply)로 정보를 보내면, 여기서 베프디 Supabase의
// 3기 전용 테이블(applications_s3)에 평면(flat)으로 저장해요.
// Supabase 키는 코드에 두지 않고 Vercel 환경변수에서만 읽어와요.
//
// 필요한 환경변수 (Vercel 대시보드 → Settings → Environment Variables):
//   - SUPABASE_URL          예) https://xxxx.supabase.co
//   - SUPABASE_SERVICE_KEY  Supabase Settings→API의 "service_role" 키 (비밀!)
// =========================================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용돼요." });
  }

  // 주소 정리: 끝 슬래시, 실수로 붙인 /rest/v1 등을 떼어내 항상 깨끗한 베이스로
  const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/+$/, "");
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "서버 설정(SUPABASE 키)이 아직 안 됐어요." });
  }

  // 폼에서 받은 값 정리
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const row = {
    name: (body.name || "").toString().trim(),
    phone: (body.phone || "").toString().trim(),
    email: (body.email || "").toString().trim(),
    role: (body.role || "").toString().trim(),
    years_exp: (body.years_exp || "").toString().trim(),
    github: (body.github || "").toString().trim(),
    ai_level: (body.ai_level || "").toString().trim(),
    team: (body.team || "").toString().trim(),
    referral: (body.referral || "").toString().trim(),
    reason: (body.reason || "").toString().trim(),
    consent_privacy: body.consent_privacy === true || body.consent_privacy === "true",
    consent_content: body.consent_content === true || body.consent_content === "true",
  };

  // 필수값 검증 (이름·전화·이메일·github·지원팀)
  if (!row.name || !row.phone || !row.email || !row.github || !row.team) {
    return res.status(400).json({
      error: "이름, 전화번호, 이메일, GitHub 아이디, 지원 팀은 꼭 필요해요.",
    });
  }

  const headers = {
    "Content-Type": "application/json",
    apikey: SERVICE_KEY,
    Authorization: "Bearer " + SERVICE_KEY,
  };

  try {
    // 3기 지원서 저장 (단순 insert — 순번 계산 없음)
    const insertRes = await fetch(SUPABASE_URL + "/rest/v1/applications_s3", {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (!insertRes.ok) {
      const text = await insertRes.text();
      console.error("Supabase insert 실패:", insertRes.status, text);
      return res.status(502).json({ error: "저장 중 문제가 생겼어요." });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("apply 함수 오류:", err);
    return res.status(500).json({ error: "서버 오류가 났어요. 잠시 후 다시 시도해 주세요." });
  }
}
