<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><title>لوحة المُصدر (محلي)</title>
<link rel="stylesheet" href="css/style.css">
<script type="module">
import { sha256File } from './js/sha256.js';
const out = (m, cls='') => { const el=document.getElementById('msg'); el.textContent=m; el.className=cls; };
async function issueFlow(e){
  e.preventDefault();
  const f = document.getElementById('file').files[0];
  const holder = document.getElementById('holder').value;
  const type = document.getElementById('type').value || 'General';
  if(!f) return out('اختر ملف الشهادة', 'error');
  if(!holder) return out('اكتب اسم صاحب الشهادة', 'error');
  // 1) حساب الهاش في المتصفح
  const docHash = await sha256File(f);
  // 2) إرسال للـAPI للحفظ في MySQL
  const fd = new FormData();
  fd.append('file', f);
  fd.append('docHash', docHash);
  fd.append('holderName', holder);
  fd.append('certType', type);
  const r = await fetch('../api/certs.php', { method:'POST', body: fd });
  const d = await r.json();
  if(d.ok) out('تم حفظ الشهادة. الهاش: '+d.docHash, 'success');
  else out('خطأ: '+(d.error||''), 'error');
}
window.issueFlow = issueFlow;
</script>
</head><body>
<h2>لوحة المُصدر (نسخة محلية بدون بلوكتشين)</h2>
<form class="card" onsubmit="return issueFlow(event)">
  <div class="row"><label>ملف الشهادة</label><input id="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"></div>
  <div class="row"><label>اسم صاحب الشهادة</label><input id="holder" placeholder="مثال: محمد أحمد"></div>
  <div class="row"><label>نوع الشهادة</label><input id="type" value="General"></div>
  <button class="btn">إصدار شهادة</button>
</form>
<div id="msg" style="margin-top:1rem;"></div>
<p>ملاحظة: هذه النسخة لا تكتب على البلوكشين؛ تحفظ فقط في قاعدة البيانات للتجربة.</p>
</body></html>
