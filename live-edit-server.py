#!/usr/bin/env python3
# =========================================================================
# BF.D 라이브 편집 서버
# -------------------------------------------------------------------------
# 미리보기 화면에서 글자를 직접 클릭해 고치고, 저장하면 파일에 바로 반영돼요.
# 저장 시 편집기가 만든 찌꺼기(거대 CSS, <font>, 인라인 스타일 등)는 자동 제거돼요.
# 실행:  python3 live-edit-server.py
# 주소:  http://127.0.0.1:8765/waitlist-a.html  (또는 waitlist-b.html)
# =========================================================================
import http.server, socketserver, os, urllib.parse

PORT = 8765
ROOT = os.path.dirname(os.path.abspath(__file__))
EDITABLE = {"waitlist-a.html", "waitlist-b.html"}

EDITOR = r"""
<style id="__bfd_style">body{word-break:keep-all;}</style>
<div id="__bfd_editor" contenteditable="false" style="position:fixed;right:16px;bottom:16px;z-index:99999;display:flex;gap:8px;align-items:center;font-family:-apple-system,sans-serif;background:#18181b;color:#fff;padding:10px 12px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.4);font-size:13px">
  <span id="__bfd_status" style="opacity:.8">✏️ 편집 켜짐 — 글자를 클릭해서 고치세요</span>
  <button id="__bfd_save" style="background:#7c3aed;color:#fff;border:0;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer">💾 저장 (⌘S)</button>
  <button id="__bfd_toggle" style="background:#3f3f46;color:#fff;border:0;border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer">편집 끄기</button>
</div>
<script id="__bfd_editor_script">
(function(){
  var FILE = location.pathname.replace(/^\//,'');
  var status = document.getElementById('__bfd_status');
  var saveBtn = document.getElementById('__bfd_save');
  var toggleBtn = document.getElementById('__bfd_toggle');
  var editing = true;

  function setEdit(on){
    editing = on;
    document.body.setAttribute('contenteditable', on ? 'true' : 'false');
    document.getElementById('__bfd_editor').setAttribute('contenteditable','false');
    toggleBtn.textContent = on ? '편집 끄기' : '편집 켜기';
    status.textContent = on ? '✏️ 편집 켜짐 — 글자를 클릭해서 고치세요' : '편집 꺼짐 (구경 모드)';
  }
  setEdit(true);

  // Enter = 줄바꿈(<br>)으로 통일 (블록 분리 방지)
  document.body.addEventListener('keydown', function(e){
    if(editing && e.key==='Enter' && !e.shiftKey){
      var t = e.target;
      if(t && t.id && t.id.indexOf('__bfd')===0) return;
      e.preventDefault();
      document.execCommand('insertLineBreak');
    }
  });

  toggleBtn.onclick = function(){ setEdit(!editing); };

  function save(){
    status.textContent = '저장 중…';
    var clone = document.documentElement.cloneNode(true);

    // 1) 편집기 자신 제거
    ['__bfd_editor','__bfd_editor_script','__bfd_style'].forEach(function(id){
      var el = clone.querySelector('#'+id); if(el) el.remove();
    });
    // 2) Tailwind CDN이 실시간 주입한 거대한 <style> 제거 (파일엔 cdn 링크만 남김)
    Array.prototype.forEach.call(clone.querySelectorAll('style'), function(s){
      var t = s.textContent || '';
      if(t.indexOf('--tw-') !== -1 || t.indexOf('tailwindcss') !== -1) s.remove();
    });
    // 3) <font> 태그 풀기 (글자만 남김)
    Array.prototype.forEach.call(clone.querySelectorAll('font'), function(f){
      while(f.firstChild) f.parentNode.insertBefore(f.firstChild, f);
      f.remove();
    });
    // 4) 인라인 style / contenteditable / 잡 속성 제거 (이 디자인은 class만 사용)
    Array.prototype.forEach.call(clone.querySelectorAll('[style]'), function(n){ n.removeAttribute('style'); });
    Array.prototype.forEach.call(clone.querySelectorAll('[contenteditable]'), function(n){ n.removeAttribute('contenteditable'); });
    Array.prototype.forEach.call(clone.querySelectorAll('*'), function(n){
      Array.prototype.slice.call(n.attributes || []).forEach(function(a){
        if(a.name.indexOf('data-cmux') === 0 || a.name.indexOf('data-bfd') === 0) n.removeAttribute(a.name);
      });
    });
    clone.removeAttribute('contenteditable');
    clone.removeAttribute('style');

    var html = '<!DOCTYPE html>\n' + clone.outerHTML + '\n';
    // 5) &nbsp; → 일반 공백, 빈 줄 과다 정리
    html = html.replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n');

    fetch('/__save?file=' + encodeURIComponent(FILE), {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: html})
      .then(function(r){ return r.text().then(function(t){ return {ok:r.ok, t:t}; }); })
      .then(function(res){
        status.textContent = res.ok ? '✅ 저장됨! 클로드에게 "봤어" 라고 하세요' : ('⚠️ ' + res.t);
      })
      .catch(function(err){ status.textContent = '⚠️ 저장 실패: ' + err; });
  }
  saveBtn.onclick = save;
  document.addEventListener('keydown', function(e){
    if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='s'){ e.preventDefault(); save(); }
  });
})();
</script>
"""

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_GET(self):
        path = self.path.split('?', 1)[0].lstrip('/')
        if path in EDITABLE:
            full = os.path.join(ROOT, path)
            with open(full, 'r', encoding='utf-8') as f:
                html = f.read()
            if '</body>' in html:
                html = html.replace('</body>', EDITOR + '\n</body>', 1)
            else:
                html += EDITOR
            data = html.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != '/__save':
            self.send_error(404); return
        qs = urllib.parse.parse_qs(parsed.query)
        fname = (qs.get('file', [''])[0]).strip()
        if fname not in EDITABLE or '/' in fname or '..' in fname:
            self.send_response(403); self.end_headers()
            self.wfile.write('허용되지 않은 파일'.encode('utf-8')); return
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')
        with open(os.path.join(ROOT, fname), 'w', encoding='utf-8') as f:
            f.write(body)
        self.send_response(200); self.end_headers()
        self.wfile.write('ok'.encode('utf-8'))

    def log_message(self, *a):
        pass

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"라이브 편집 서버 실행 중 → http://127.0.0.1:{PORT}/waitlist-a.html")
    httpd.serve_forever()
