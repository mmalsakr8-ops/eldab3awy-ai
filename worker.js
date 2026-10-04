import { InferenceClient } from '@huggingface/inference';

const COOKIE = 'eldab3awy_session';
const SESSION_DAYS = 30;
const ADMIN_EMAIL = 'mmalsakr8@gmail.com';
const VIDEO_MODEL = 'Wan-AI/Wan2.1-T2V-1.3B';
const enc = new TextEncoder();

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

async function sha256(s){
  const b = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function hashPassword(password){
  const salt = uid();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:120000,hash:'SHA-256'}, key, 256);
  return salt + '$' + [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function verifyPassword(password, stored){
  const [salt, wanted] = String(stored||'').split('$');
  if(!salt || !wanted) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:120000,hash:'SHA-256'}, key, 256);
  const got = [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('');
  return got === wanted;
}
function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
}
function cookie(name,value,maxAge){
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function clearCookie(){ return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
async function body(req){ try{return await req.json()}catch{return {}} }

async function currentUser(req,env){
  const raw = req.headers.get('Cookie') || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)'+COOKIE+'=([^;]+)'));
  if(!m) return null;
  const token = decodeURIComponent(m[1]);
  const th = await sha256(token);
  return await env.DB.prepare(`SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).bind(th,now()).first();
}

function layout(title,content,user=null){
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(title)} — الضبعاوي AI</title><style>
  :root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;background:#07111f;color:#edf4ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#142b46 0,#07111f 48%,#040914 100%);min-height:100vh}a{text-decoration:none;color:inherit}.wrap{max-width:1100px;margin:auto;padding:18px}.nav{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0}.brand{display:flex;align-items:center;gap:10px;font-weight:900}.mark{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,#ffd166,#ef476f);color:#111;font-size:22px;box-shadow:0 8px 25px #0005}.brand small{display:block;color:#9fb1c8;font-weight:500}.card{background:#0c1a2bde;border:1px solid #ffffff14;border-radius:22px;padding:22px;box-shadow:0 18px 60px #0004;margin:14px 0}.hero{padding:45px 25px;text-align:center}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}.field{display:flex;flex-direction:column;gap:7px;margin:12px 0}.field label{font-weight:700}.field input,.field textarea,.field select{width:100%;background:#071321;color:#fff;border:1px solid #ffffff18;border-radius:13px;padding:12px;font:inherit;outline:none}.field textarea{min-height:180px;resize:vertical}.btn{border:0;border-radius:13px;padding:12px 18px;font:inherit;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px}.primary{background:linear-gradient(135deg,#ffd166,#ff8c42);color:#161616}.ghost{background:#ffffff10;color:#fff;border:1px solid #ffffff18}.danger{background:#ff4d6d;color:#fff}.muted{color:#9fb1c8}.ok{color:#65e6a2}.err{color:#ff8095}.actions{display:flex;flex-wrap:wrap;gap:10px}.scene{border:1px solid #ffffff14;border-radius:18px;padding:17px;margin-top:15px;background:#071321}.videoBox{margin-top:12px}.videoBox video{width:100%;max-height:520px;border-radius:16px;background:#000}.status{padding:10px 0;min-height:22px}.badge{display:inline-block;padding:5px 10px;border-radius:999px;background:#ffffff10;color:#bcd0e6;font-size:13px}.footer{text-align:center;color:#8294aa;padding:35px 10px;font-size:13px}h1,h2,h3{margin-top:0}code{direction:ltr;display:inline-block}.topline{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}@media(max-width:600px){.hero{padding:30px 14px}.card{padding:17px}.actions .btn{width:100%}}
  </style></head><body><div class="wrap"><nav class="nav"><a class="brand" href="/"><span class="mark">ض</span><span>الضبعاوي AI<small>من الفكرة إلى الفيلم</small></span></a>${user?`<div class="actions"><a class="btn ghost" href="/dashboard">لوحة التحكم</a><form method="post" action="/logout"><button class="btn ghost">خروج</button></form></div>`:''}</nav>${content}<div class="footer">جميع الحقوق محفوظة بواسطة M/ Mohamed Abdalazim</div></div></body></html>`;
}

async function authPage(req,env,mode,error=''){
  const reg=mode==='register';
  const title=reg?'إنشاء حساب جديد':'تسجيل الدخول';
  const action=reg?'/register':'/login';
  const loginHref='/login';
  const passwordAutocomplete=reg?'new-password':'current-password';
  const passwordHint=reg?'8 أحرف على الأقل':'أدخل كلمة المرور';
  const errorBox=error?`<div class="card" style="border-color:#ff809555;background:#3a1220"><strong class="err">${esc(error)}</strong></div>`:'';
  const nameField=reg?'<div class="field"><label>الاسم</label><input name="name" required maxlength="80" autocomplete="name" placeholder="اكتب اسمك"></div>':'';
  return new Response(layout(title,`${errorBox}<div class="card" style="max-width:520px;margin:45px auto"><h1>${title}</h1><p class="muted">${reg?'أنشئ حسابك مرة واحدة وابدأ مشروعك السينمائي مباشرة.':'أدخل بيانات حسابك للمتابعة.'}</p><form method="post" action="${action}" autocomplete="${reg?'on':'on'}">${nameField}<div class="field"><label>البريد الإلكتروني</label><input type="email" name="email" required maxlength="160" autocomplete="email" placeholder="name@example.com"></div><div class="field"><label>كلمة المرور</label><input type="password" name="password" required minlength="8" maxlength="128" autocomplete="${passwordAutocomplete}" placeholder="${passwordHint}"></div><button class="btn primary" type="submit" style="width:100%">${reg?'إنشاء الحساب والبدء':'دخول'}</button></form><p class="muted" style="margin-bottom:0;text-align:center">${reg?'لديك حساب بالفعل؟ <a href="/login">تسجيل الدخول</a>':'ليس لديك حساب؟ <a href="/register">إنشاء حساب جديد</a>'}</p></div>`),null,{headers:{'content-type':'text/html; charset=utf-8'}});
}

async function register(req,env){
  try{
    const form=await req.formData();
    const name=String(form.get('name')||'').trim();
    const email=String(form.get('email')||'').trim().toLowerCase();
    const password=String(form.get('password')||'');
    if(name.length<2)return authPage(req,env,'register','اكتب اسمًا صحيحًا.');
    if(!email)return authPage(req,env,'register','اكتب البريد الإلكتروني.');
    if(password.length<8)return authPage(req,env,'register','كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
    const exists=await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
    if(exists)return authPage(req,env,'register','هذا البريد الإلكتروني مستخدم بالفعل. يمكنك تسجيل الدخول بدلًا من إنشاء حساب جديد.');
    const role=email===ADMIN_EMAIL?'admin':'user';
    const id=uid();
    const ph=await hashPassword(password);
    await env.DB.prepare('INSERT INTO users(id,name,email,password_hash,role) VALUES(?,?,?,?,?)').bind(id,name,email,ph,role).run();
    const token=crypto.randomUUID()+'-'+crypto.randomUUID();
    const th=await sha256(token);
    const expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();
    await env.DB.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)').bind(uid(),id,th,expires).run();
    return new Response(null,{status:303,headers:{Location:'/dashboard','Set-Cookie':cookie(COOKIE,token,SESSION_DAYS*86400)}});
  }catch(e){
    return authPage(req,env,'register','تعذر إنشاء الحساب حاليًا. تأكد أن قاعدة البيانات جاهزة ثم حاول مرة أخرى.');
  }
}

async function login(req,env){
  const form=await req.formData(); const email=String(form.get('email')||'').trim().toLowerCase(); const password=String(form.get('password')||'');
  const u=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
  if(!u || !(await verifyPassword(password,u.password_hash)))return new Response(layout('فشل الدخول','<div class="card"><h2>البريد أو كلمة المرور غير صحيحة.</h2><a class="btn ghost" href="/login">حاول مرة أخرى</a></div>'),{status:401,headers:{'content-type':'text/html; charset=utf-8'}});
  const token=crypto.randomUUID()+'-'+crypto.randomUUID(); const th=await sha256(token); const expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();
  await env.DB.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)').bind(uid(),u.id,th,expires).run();
  return new Response(null,{status:303,headers:{Location:'/dashboard','Set-Cookie':cookie(COOKIE,token,SESSION_DAYS*86400)}});
}

async function logout(req,env){
  const raw=req.headers.get('Cookie')||''; const m=raw.match(new RegExp('(?:^|;\\s*)'+COOKIE+'=([^;]+)')); if(m){const th=await sha256(decodeURIComponent(m[1])); await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(th).run().catch(()=>{});} return new Response(null,{status:303,headers:{Location:'/','Set-Cookie':clearCookie()}});
}

async function dashboard(req,env,u){
  const ps=await env.DB.prepare('SELECT * FROM projects WHERE user_id=? ORDER BY updated_at DESC').bind(u.id).all();
  const rows=(ps.results||[]).map(p=>`<div class="card"><div class="topline"><div><h3>${esc(p.name)}</h3><div class="muted">${esc(p.genre||'')} · ${esc(p.tone||'')}</div></div><span class="badge">${esc(p.status)}</span></div><p>${esc(p.idea)}</p><div class="actions"><a class="btn primary" href="/project/${encodeURIComponent(p.id)}">فتح المشروع</a></div></div>`).join('');
  return new Response(layout('لوحة التحكم',`<div class="card hero"><h1>مرحبًا ${esc(u.name)} 👋</h1><p class="muted">اكتب السيناريو، اصنع المشاهد، ثم ولّد الفيديو وحمّله على الموبايل.</p><a class="btn primary" href="/new-project">+ مشروع جديد</a></div><h2>مشاريعك</h2>${rows||'<div class="card"><p class="muted">لا توجد مشاريع حتى الآن.</p></div>'}` ,u),{headers:{'content-type':'text/html; charset=utf-8'}});
}

async function createProject(req,env,u){
  const form=await req.formData(); const name=String(form.get('name')||'').trim(); const idea=String(form.get('idea')||'').trim(); const genre=String(form.get('genre')||'').trim(); const tone=String(form.get('tone')||'').trim();
  if(!name)return new Response('اسم المشروع مطلوب',{status:400});
  const id=uid(); await env.DB.prepare('INSERT INTO projects(id,user_id,name,idea,genre,tone) VALUES(?,?,?,?,?,?)').bind(id,u.id,name,idea,genre,tone).run();
  await env.DB.prepare('INSERT INTO scenario_versions(id,project_id,version_no,content) VALUES(?,?,?,?)').bind(uid(),id,1,'').run();
  return Response.redirect(new URL('/project/'+id,req.url),303);
}

async function projectPage(req,env,u,id){
  const p=await env.DB.prepare('SELECT * FROM projects WHERE id=? AND user_id=?').bind(id,u.id).first(); if(!p)return new Response('المشروع غير موجود',{status:404});
  const sc=await env.DB.prepare('SELECT * FROM scenes WHERE project_id=? ORDER BY scene_no').bind(id).all();
  const version=await env.DB.prepare('SELECT * FROM scenario_versions WHERE project_id=? ORDER BY version_no DESC LIMIT 1').bind(id).first();
  const scenes=(sc.results||[]).map(s=>`<div class="scene"><div class="topline"><h3>المشهد ${s.scene_no}: ${esc(s.title||'بدون عنوان')}</h3><span class="badge">${esc(s.location||'')}</span></div><p>${esc(s.description)}</p>${s.dialogue?`<p><b>الحوار:</b> ${esc(s.dialogue)}</p>`:''}<div class="field"><label>نسبة الفيديو</label><select id="ratio-${s.id}"><option>16:9</option><option>9:16</option></select></div><div class="actions"><button class="btn primary" type="button" onclick="createVideo('${p.id}','${s.id}',this)">🎬 إنشاء فيديو</button></div><div id="video-status-${s.id}" class="status muted"></div><div id="video-box-${s.id}" class="videoBox" style="display:none"><video id="video-${s.id}" controls playsinline></video><div class="actions" style="margin-top:10px"><a id="download-${s.id}" class="btn primary" download="eldab3awy-scene-${s.scene_no}.mp4">⬇️ تحميل الفيديو على الموبايل</a></div></div></div>`).join('');
  return new Response(layout(p.name,`<div class="card"><div class="topline"><div><h1>${esc(p.name)}</h1><p class="muted">${esc(p.idea)}</p></div><span class="badge">${esc(p.genre||'فيلم')}</span></div><form method="post" action="/project/${id}/scenario"><div class="field"><label>السيناريو</label><textarea name="content" placeholder="اكتب السيناريو الكامل هنا...">${esc(version?.content||'')}</textarea></div><button class="btn primary">💾 حفظ نسخة جديدة</button></form></div><div class="card"><div class="topline"><h2>المشاهد والفيديو</h2><a class="btn ghost" href="/project/${id}/scene/new">+ إضافة مشهد</a></div>${scenes||'<p class="muted">أضف أول مشهد لتجربة توليد الفيديو.</p>'}</div><script>
async function createVideo(projectId,sceneId,btn){const status=document.getElementById('video-status-'+sceneId),box=document.getElementById('video-box-'+sceneId),video=document.getElementById('video-'+sceneId),download=document.getElementById('download-'+sceneId),ratio=document.getElementById('ratio-'+sceneId).value;btn.disabled=true;const old=btn.textContent;btn.textContent='⏳ جاري إنشاء الفيديو...';status.textContent='يتم إرسال المشهد إلى محرك الفيديو. قد يستغرق الأمر وقتًا.';box.style.display='none';try{const r=await fetch('/project/'+encodeURIComponent(projectId)+'/scenes/'+encodeURIComponent(sceneId)+'/video',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({aspect_ratio:ratio})});if(!r.ok){let m='فشل إنشاء الفيديو';try{const d=await r.json();m=d.error||d.detail||m}catch{}throw new Error(m)}const blob=await r.blob();if(!blob.size)throw new Error('تم إنشاء رد فارغ من محرك الفيديو');const url=URL.createObjectURL(blob);video.src=url;download.href=url;box.style.display='block';status.textContent='✅ تم إنشاء الفيديو. اضغط «تحميل الفيديو على الموبايل» لحفظه.';video.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){status.textContent='❌ '+(e.message||'حدث خطأ')}finally{btn.disabled=false;btn.textContent=old}}
</script>` ,u),{headers:{'content-type':'text/html; charset=utf-8'}});
}

async function saveScenario(req,env,u,id){
  const p=await env.DB.prepare('SELECT id FROM projects WHERE id=? AND user_id=?').bind(id,u.id).first(); if(!p)return new Response('Not found',{status:404}); const form=await req.formData(); const content=String(form.get('content')||''); const last=await env.DB.prepare('SELECT COALESCE(MAX(version_no),0) n FROM scenario_versions WHERE project_id=?').bind(id).first(); const n=Number(last?.n||0)+1; await env.DB.prepare('INSERT INTO scenario_versions(id,project_id,version_no,content) VALUES(?,?,?,?)').bind(uid(),id,n,content).run(); await env.DB.prepare('UPDATE projects SET updated_at=? WHERE id=?').bind(now(),id).run(); return Response.redirect(new URL('/project/'+id,req.url),303);
}

async function addScenePage(req,env,u,id){const p=await env.DB.prepare('SELECT id,name FROM projects WHERE id=? AND user_id=?').bind(id,u.id).first();if(!p)return new Response('Not found',{status:404});return new Response(layout('إضافة مشهد',`<div class="card"><h1>إضافة مشهد إلى ${esc(p.name)}</h1><form method="post" action="/project/${id}/scene/new"><div class="grid"><div class="field"><label>عنوان المشهد</label><input name="title" required></div><div class="field"><label>المكان</label><input name="location"></div><div class="field"><label>الوقت</label><input name="time_of_day" placeholder="نهار / ليل"></div></div><div class="field"><label>الوصف</label><textarea name="description" required></textarea></div><div class="field"><label>الحوار</label><textarea name="dialogue"></textarea></div><div class="field"><label>التوجيه البصري</label><textarea name="visual_prompt" placeholder="الشخصيات، الحركة، الكاميرا، الإضاءة..."></textarea></div><button class="btn primary">حفظ المشهد</button></form></div>` ,u),{headers:{'content-type':'text/html; charset=utf-8'}})}

async function addScene(req,env,u,id){const p=await env.DB.prepare('SELECT id FROM projects WHERE id=? AND user_id=?').bind(id,u.id).first();if(!p)return new Response('Not found',{status:404});const form=await req.formData();const last=await env.DB.prepare('SELECT COALESCE(MAX(scene_no),0) n FROM scenes WHERE project_id=?').bind(id).first();const no=Number(last?.n||0)+1;await env.DB.prepare('INSERT INTO scenes(id,project_id,scene_no,title,location,time_of_day,description,dialogue,visual_prompt) VALUES(?,?,?,?,?,?,?,?,?)').bind(uid(),id,no,String(form.get('title')||''),String(form.get('location')||''),String(form.get('time_of_day')||''),String(form.get('description')||''),String(form.get('dialogue')||''),String(form.get('visual_prompt')||'')).run();return Response.redirect(new URL('/project/'+id,req.url),303)}

async function createSceneVideo(req,env,u,projectId,sceneId){
  if(!env['HF_'+'TOKEN']) return json({ok:false,error:'خدمة الفيديو غير مفعلة: Secret باسم HF_TOKEN غير متاح للـ Worker الحالي.'},503);
  const scene=await env.DB.prepare('SELECT s.*,p.name project_name FROM scenes s JOIN projects p ON p.id=s.project_id WHERE s.id=? AND s.project_id=? AND p.user_id=?').bind(sceneId,projectId,u.id).first();
  if(!scene)return json({ok:false,error:'المشهد غير موجود أو لا تملك هذا المشروع.'},404);
  const b=await body(req); const ratio=b.aspect_ratio==='9:16'?'9:16':'16:9';
  const prompt=[
    'Create a short cinematic realistic video scene for an Arabic screenplay.',
    `Aspect ratio composition: ${ratio}.`,
    `Project: ${scene.project_name||''}.`,
    `Scene title: ${scene.title||'Untitled'}.`,
    `Location: ${scene.location||'unspecified'}.`,
    `Time: ${scene.time_of_day||'unspecified'}.`,
    `Description: ${scene.description||''}.`,
    `Dialogue/context: ${scene.dialogue||''}.`,
    `Visual direction: ${scene.visual_prompt||''}.`,
    'Natural character motion, coherent anatomy, cinematic camera movement, realistic lighting, detailed environment, no subtitles, no text, no logos, no watermark.'
  ].join('\n');
  const videoId=uid(); await env.DB.prepare('INSERT INTO videos(id,project_id,scene_id,prompt,aspect_ratio,model,status) VALUES(?,?,?,?,?,?,?)').bind(videoId,projectId,sceneId,prompt,ratio,VIDEO_MODEL,'generating').run();
  try{
    const client=new InferenceClient(env['HF_'+'TOKEN']);
    const output=await client.textToVideo({model:VIDEO_MODEL,inputs:prompt,parameters:{num_frames:49,num_inference_steps:20,guidance_scale:5,negative_prompt:['text','subtitles','watermark','logo']},provider:'fal-ai'});
    if(!(output instanceof Blob)) throw new Error('محرك الفيديو أعاد نتيجة غير متوقعة.');
    if(output.size===0) throw new Error('محرك الفيديو أعاد ملفًا فارغًا.');
    await env.DB.prepare('UPDATE videos SET status=?,mime_type=?,completed_at=? WHERE id=?').bind('completed',output.type||'video/mp4',now(),videoId).run();
    const headers=new Headers({'content-type':output.type||'video/mp4','cache-control':'no-store','content-disposition':`attachment; filename="eldab3awy-${scene.scene_no}.mp4"`,'x-video-id':videoId});
    return new Response(output,{status:200,headers});
  }catch(e){const detail=String(e?.message||e);await env.DB.prepare('UPDATE videos SET status=?,error=? WHERE id=?').bind('failed',detail,videoId).run().catch(()=>{});return json({ok:false,error:'فشل إنشاء الفيديو.',detail},502)}
}

export default {async fetch(req,env){
  const url=new URL(req.url); const path=url.pathname; const method=req.method;
  try{
    if(path==='/health')return json({ok:true,service:'eldab3awy-ai',database:'eldab3awy-db',hf_token_configured:Boolean(env['HF_'+'TOKEN']),time:now()});
    if(path==='/')return new Response(layout('الرئيسية',`<div class="card hero"><div class="mark" style="margin:0 auto 15px">ض</div><h1>الضبعاوي AI 🎬</h1><p class="muted">منصة عربية لتحويل فكرتك وسيناريوك إلى مشاهد وفيديو.</p><div class="actions" style="justify-content:center"><a class="btn primary" href="/register">ابدأ الآن</a><a class="btn ghost" href="/login">تسجيل الدخول</a></div></div><div class="grid"><div class="card"><h3>✍️ السيناريو</h3><p class="muted">احفظ السيناريو بنسخ متتابعة بدون فقدان العمل.</p></div><div class="card"><h3>🎬 المشاهد</h3><p class="muted">حوّل كل مشهد إلى وصف بصري جاهز للتوليد.</p></div><div class="card"><h3>⬇️ الفيديو</h3><p class="muted">ولّد فيديو المشهد ثم حمّله مباشرة على الموبايل.</p></div></div>`),{headers:{'content-type':'text/html; charset=utf-8'}});
    if(path==='/register'&&method==='GET')return authPage(req,env,'register');
    if(path==='/register'&&method==='POST')return register(req,env);
    if(path==='/login'&&method==='GET')return authPage(req,env,'login');
    if(path==='/login'&&method==='POST')return login(req,env);
    if(path==='/logout'&&method==='POST')return logout(req,env);
    const u=await currentUser(req,env); if(!u)return Response.redirect(new URL('/login',req.url),303);
    if(path==='/dashboard')return dashboard(req,env,u);
    if(path==='/new-project'&&method==='GET')return new Response(layout('مشروع جديد',`<div class="card"><h1>مشروع جديد</h1><form method="post" action="/new-project"><div class="field"><label>اسم المشروع</label><input name="name" required></div><div class="field"><label>الفكرة</label><textarea name="idea"></textarea></div><div class="grid"><div class="field"><label>النوع</label><input name="genre" placeholder="فيلم قصير"></div><div class="field"><label>النغمة</label><input name="tone" placeholder="درامي"></div></div><button class="btn primary">إنشاء المشروع</button></form></div>`,u),{headers:{'content-type':'text/html; charset=utf-8'}});
    if(path==='/new-project'&&method==='POST')return createProject(req,env,u);
    let m=path.match(/^\/project\/([^/]+)$/); if(m&&method==='GET')return projectPage(req,env,u,m[1]);
    m=path.match(/^\/project\/([^/]+)\/scenario$/); if(m&&method==='POST')return saveScenario(req,env,u,m[1]);
    m=path.match(/^\/project\/([^/]+)\/scene\/new$/); if(m&&method==='GET')return addScenePage(req,env,u,m[1]);
    if(m&&method==='POST')return addScene(req,env,u,m[1]);
    m=path.match(/^\/project\/([^/]+)\/scenes\/([^/]+)\/video$/); if(m&&method==='POST')return createSceneVideo(req,env,u,m[1],m[2]);
    return new Response('Not Found',{status:404});
  }catch(e){return json({ok:false,error:'خطأ داخلي',detail:String(e?.message||e)},500)}
}};
