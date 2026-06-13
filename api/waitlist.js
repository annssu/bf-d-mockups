// =========================================================================
// BF.D 웨잇리스트 — 신청 저장 서버 함수 (Vercel Serverless Function)
// -------------------------------------------------------------------------
// 신청 폼이 이 주소(/api/waitlist)로 정보를 보내면, 여기서 베프디 Supabase에
// 저장해요. Supabase 키는 코드에 두지 않고 Vercel 환경변수에서 읽어와요.
//
// 필요한 환경변수 (Vercel 대시보드 → Settings → Environment Variables):
//   - SUPABASE_URL         예) https://xxxx.supabase.co
//   - SUPABASE_SERVICE_KEY  Supabase Settings→API의 "service_role" 키 (비밀!)
// =========================================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용돼요." });
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const START_NUMBER = parseInt(process.env.WAITLIST_START_NUMBER || "47", 10);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "서버 설정(SUPABASE 키)이 아직 안 됐어요." });
  }

  // 폼에서 받은 값 정리
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const row = {
    name: (body.name || "").toString().trim(),
    phone: (body.phone || "").toString().trim(),
    reason: (body.reason || "").toString().trim(),
    linkedin: (body.linkedin || "").toString().trim(),
    source: (body.source || "BF.D waitlist").toString().trim(),
  };

  if (!row.name || !row.phone) {
    return res.status(400).json({ error: "이름과 전화번호는 꼭 필요해요." });
  }

  const headers = {
    "Content-Type": "application/json",
    apikey: SERVICE_KEY,
    Authorization: "Bearer " + SERVICE_KEY,
  };

  try {
    // 1) 신청 저장
    const insertRes = await fetch(SUPABASE_URL + "/rest/v1/waitlist", {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
    if (!insertRes.ok) {
      const text = await insertRes.text();
      console.error("Supabase insert 실패:", insertRes.status, text);
      // 진단 모드: 원인 파악용으로 Supabase 응답을 잠깐 노출 (확인 후 되돌릴 예정)
      return res.status(502).json({ error: "저장 중 문제가 생겼어요.", _debug: { status: insertRes.status, body: text.slice(0, 300) } });
    }

    // 2) 누적 인원 세서 대기 순번 계산
    let position = START_NUMBER;
    const countRes = await fetch(SUPABASE_URL + "/rest/v1/waitlist?select=id", {
      method: "GET",
      headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
    });
    const range = countRes.headers.get("content-range") || "";
    const total = parseInt(range.split("/")[1], 10);
    if (!isNaN(total) && total > 0) position = START_NUMBER + total - 1;

    return res.status(200).json({ ok: true, position });
  } catch (err) {
    console.error("waitlist 함수 오류:", err);
    return res.status(500).json({ error: "서버 오류가 났어요. 잠시 후 다시 시도해 주세요." });
  }
}
