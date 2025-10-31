<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><title>التحقق من الشهادة</title>
<link rel="stylesheet" href="css/style.css">
</head><body>
<h2>التحقق من الشهادة</h2>
<div class="card">
  <div class="row"><label>أدخل الهاش (0x...):</label><input id="h" placeholder="0x..."></div>
  <button class="btn" onclick="check()">تحقق</button>
</div>
<pre id="out"></pre>
<script>
async function check(){
  const val = document.getElementById('h').value;
  const r = await fetch('../api/verify.php?hash='+encodeURIComponent(val));
  const d = await r.json();
  document.getElementById('out').textContent = JSON.stringify(d, null, 2);
}
</script>
</body></html>
