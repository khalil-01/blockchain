<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><title>تسجيل الدخول</title>
<link rel="stylesheet" href="css/style.css">
</head><body>
<h2>تسجيل الدخول</h2>
<form class="card" onsubmit="return login(event)">
  <div class="row"><label>البريد الإلكتروني</label><input id="email"></div>
  <div class="row"><label>كلمة المرور</label><input id="pass" type="password"></div>
  <button class="btn">دخول</button>
</form>
<div id="msg"></div>
<script>
async function login(e){e.preventDefault();
  const r=await fetch('../api/auth.php?action=login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.value,password:pass.value})});
  const d=await r.json(); document.getElementById('msg').textContent = d.ok ? 'تم الدخول' : ('خطأ: '+(d.error||''));
  if(d.ok) setTimeout(()=>location.href='issuer.php',700);
}
</script>
</body></html>
