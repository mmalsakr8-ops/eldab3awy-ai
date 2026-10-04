import { InferenceClient } from "@huggingface/inference";

const COOKIE='eldab3awy_session';
const SESSION_DAYS=30;
const enc=new TextEncoder();
const dec=new TextDecoder();

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID();
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}});
const redirect=(url,headers={})=>new Response(null,{status:302,headers:{Location:url,...headers}});
const now=()=>new Date().toISOString();
let schemaReady=false;
async function ensureSchema(env){
  if(schemaReady)return;
  const stmts=[
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,role TEXT NOT NULL DEFAULT 'user')`,
    `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT NOT NULL,idea TEXT,genre TEXT,tone TEXT,language TEXT,status TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS scripts (id TEXT PRIMARY KEY,project_id TEXT NOT NULL,content TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS characters (id TEXT PRIMARY KEY,project_id TEXT NOT NULL,name TEXT NOT NULL,role TEXT,description TEXT,traits TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS scenes (id TEXT PRIMARY KEY,project_id TEXT NOT NULL,scene_number INTEGER NOT NULL,title TEXT,location TEXT,time_of_day TEXT,description TEXT,dialogue TEXT,visual_prompt TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS videos (id TEXT PRIMARY KEY,project_id TEXT NOT NULL,scene_id TEXT NOT NULL,prompt TEXT NOT NULL,aspect_ratio TEXT NOT NULL DEFAULT '16:9',status TEXT NOT NULL DEFAULT 'completed',model TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_scripts_project ON scripts(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_videos_scene ON videos(scene_id)`
  ];
  for(const sql of stmts){try{await env.DB.prepare(sql).run()}catch(e){/* existing/incompatible objects are handled below */}}
  const migrations=[
    `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`,
    `ALTER TABLE scripts ADD COLUMN version INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE scripts ADD COLUMN updated_at TEXT`,
    `ALTER TABLE projects ADD COLUMN genre TEXT`,
    `ALTER TABLE projects ADD COLUMN tone TEXT`,
    `ALTER TABLE projects ADD COLUMN language TEXT`,
    `ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'`,
    `ALTER TABLE projects ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE projects ADD COLUMN updated_at TEXT`,
    `ALTER TABLE scenes ADD COLUMN visual_prompt TEXT`,
    `ALTER TABLE scenes ADD COLUMN dialogue TEXT`,
    `ALTER TABLE scenes ADD COLUMN time_of_day TEXT`,
    `ALTER TABLE scenes ADD COLUMN location TEXT`,
    `ALTER TABLE scenes ADD COLUMN description TEXT`,
    `ALTER TABLE scenes ADD COLUMN title TEXT`,
    `ALTER TABLE scenes ADD COLUMN scene_number INTEGER NOT NULL DEFAULT 1`
  ];
  for(const sql of migrations){try{await env.DB.prepare(sql).run()}catch(e){}}
  try{await env.DB.prepare(`UPDATE users SET role='admin' WHERE lower(email)=?`).bind('mmalsakr8@gmail.com').run()}catch(e){}
  schemaReady=true;
}

async function sha(s){const b=await crypto.subtle.digest('SHA-256',enc.encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function cookies(req){const o={};(req.headers.get('Cookie')||'').split(';').forEach(p=>{const i=p.indexOf('=');if(i>0)o[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim())});return o}
function setCookie(token,maxAge=SESSION_DAYS*86400){return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
function clearCookie(){return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
async function currentUser(req,env){const raw=cookies(req)[COOKIE];if(!raw)return null;const h=await sha(raw);return await env.DB.prepare(`SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).bind(h,now()).first()}
async function createSession(userId,env){const raw=crypto.randomUUID()+'-'+crypto.randomUUID();const expires=new Date(Date.now()+SESSION_DAYS*86400*1000).toISOString();await env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now()).run();await env.DB.prepare('INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)').bind(uid(),userId,await sha(raw),expires).run();return raw}
async function body(req){try{return await req.json()}catch{return {}}}
function isApi(req){return new URL(req.url).pathname.startsWith('/api/')}
function page(title,content,user=null){return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b1020"><title>${esc(title)} — الضبعاوي AI</title><style>
:root{--bg:#080c18;--panel:#10182b;--panel2:#141f36;--text:#f8fafc;--muted:#9aa7bd;--line:#25324b;--gold:#f59e0b;--red:#ef4444;--ok:#22c55e}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 10% 0,#17213b 0,transparent 35%),var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif;min-height:100vh}a{color:inherit;text-decoration:none}.wrap{max-width:1180px;margin:auto;padding:20px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0 22px}.brand{display:flex;align-items:center;gap:10px;font-weight:900;font-size:21px}.mark{width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,var(--gold),var(--red));display:grid;place-items:center;color:#111827;font-weight:1000}.ai{color:#fbbf24}.nav{display:flex;gap:8px;flex-wrap:wrap}.nav a,.btn{border:1px solid var(--line);background:#111a2d;color:var(--text);padding:10px 14px;border-radius:11px;cursor:pointer;font-weight:700}.nav a:hover,.btn:hover{border-color:#51617f}.btn.primary{border:0;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#111827}.btn.danger{background:#351722;border-color:#6f2a3a}.hero{padding:46px 0 30px}.hero h1{font-size:clamp(34px,7vw,66px);line-height:1.02;margin:12px 0}.hero p{max-width:760px;color:var(--muted);font-size:18px;line-height:1.9}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.card{background:rgba(16,24,43,.9);border:1px solid var(--line);border-radius:18px;padding:20px}.card h3{margin:0 0 8px}.muted{color:var(--muted)}.small{font-size:13px}.form{max-width:720px;margin:30px auto}.label{display:block;margin:14px 0 7px;font-weight:800}.input,.select,.textarea{width:100%;border:1px solid var(--line);background:#0c1324;color:var(--text);border-radius:12px;padding:12px 13px;font:inherit;outline:none}.input:focus,.select:focus,.textarea:focus{border-color:var(--gold)}.textarea{min-height:170px;resize:vertical}.actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}.alert{padding:12px 14px;border-radius:12px;background:#3a1720;border:1px solid #702b3a;color:#fecaca;margin:15px 0}.success{background:#102d21;border-color:#235b42;color:#bbf7d0}.stat{font-size:30px;font-weight:900}.list{display:grid;gap:12px}.project{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px;border:1px solid var(--line);border-radius:14px;background:#0d1526}.project .info{min-width:0}.project h3{margin:0 0 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.badge{display:inline-block;padding:4px 8px;border-radius:999px;background:#202b42;color:#cbd5e1;font-size:12px}.tabs{display:flex;gap:8px;overflow:auto;padding-bottom:4px}.tabs a{padding:9px 12px;border:1px solid var(--line);border-radius:10px}.footer{border-top:1px solid var(--line);margin-top:45px;padding:22px 0;color:var(--muted);font-size:13px;text-align:center}.two{grid-template-columns:280px 1fr}.item{border:1px solid var(--line);padding:14px;border-radius:13px;background:#0d1526}.item h4{margin:0 0 5px}.empty{text-align:center;padding:45px 15px;color:var(--muted)}@media(max-width:800px){.grid,.grid2,.two{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}.project{align-items:flex-start;flex-direction:column}.hero{padding-top:25px}}
</style></head><body><div class="wrap"><header class="top"><a class="brand" href="/"><span class="mark">ض</span><span>الضبعاوي <span class="ai">AI</span></span></a><nav class="nav">${user?`<a href="/dashboard">لوحة التحكم</a><a href="/project/new">+ مشروع</a><a href="/logout">خروج</a>`:`<a href="/login">دخول</a><a class="btn primary" href="/register">ابدأ الآن</a>`}</nav></header>${content}<footer class="footer">© 2026 الضبعاوي AI — منصة صناعة المحتوى والمشاريع بالذكاء الاصطناعي</footer></div></body></html>`}
function home(user){return page('الرئيسية',`<section class="hero"><span class="badge">من الفكرة إلى المشروع 🎬</span><h1>اصنع فكرتك.<br><span class="ai">طوّرها بالـ AI.</span></h1><p>الضبعاوي AI مساحة عربية لتنظيم أفكار المحتوى، بناء المشاريع، كتابة السيناريو، الشخصيات والمشاهد في مكان واحد. الأساس محفوظ وقابل للتوسع.</p><div class="actions"><a class="btn primary" href="${user?'/dashboard':'/register'}">${user?'اذهب إلى مشاريعي':'ابدأ مشروعك الآن'}</a>${!user?'<a class="btn" href="/login">لدي حساب بالفعل</a>':''}</div></section><section class="grid"><div class="card"><h3>💡 فكرة</h3><p class="muted">احفظ الفكرة الأساسية والنوع والنبرة واللغة لكل مشروع.</p></div><div class="card"><h3>📝 سيناريو</h3><p class="muted">محرر طويل لحفظ السيناريو وتطويره بدون فقدان عملك.</p></div><div class="card"><h3>🎞️ مشاهد وشخصيات</h3><p class="muted">نظّم الشخصيات والمشاهد والوصف البصري والحوار.</p></div></section>` ,user)}
function authPage(type,error=''){const reg=type==='register';return page(reg?'إنشاء حساب':'دخول',`<div class="card form"><h1>${reg?'إنشاء حساب جديد':'تسجيل الدخول'}</h1><p class="muted">${reg?'أنشئ حسابك وابدأ أول مشروع.':'أدخل بيانات حسابك للمتابعة.'}</p>${error?`<div class="alert">${esc(error)}</div>`:''}<form method="post" action="/${reg?'register':'login'}">${reg?'<label class="label">الاسم</label><input class="input" name="name" required maxlength="80" autocomplete="name">':''}<label class="label">البريد الإلكتروني</label><input class="input" type="email" name="email" required maxlength="160" autocomplete="email"><label class="label">كلمة المرور</label><input class="input" type="password" name="password" required minlength="8" maxlength="128" autocomplete="${reg?'new-password':'current-password'}"><div class="actions"><button class="btn primary" type="submit">${reg?'إنشاء الحساب':'دخول'}</button><a class="btn" href="/${reg?'login':'register'}">${reg?'لدي حساب':'إنشاء حساب'}</a></div></form></div>`)}
function dashboard(user,projects){return page('لوحة التحكم',`<section><div class="card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><h1 style="margin:0 0 7px">مرحبًا ${esc(user.name)} 👋</h1><p class="muted" style="margin:0">${esc(user.email)}</p></div><a class="btn primary" href="/project/new">+ إنشاء مشروع</a></div></div><div class="grid" style="margin:16px 0"><div class="card"><div class="muted">مشاريعي</div><div class="stat">${projects.length}</div></div><div class="card"><div class="muted">الحالة</div><div class="stat">جاهز</div></div><div class="card"><div class="muted">المرحلة</div><div class="stat">1</div></div></div><div class="card"><h2>مشاريعك</h2>${projects.length?`<div class="list">${projects.map(p=>`<div class="project"><div class="info"><h3>${esc(p.title)}</h3><div class="muted small">${esc(p.genre||'بدون نوع')} · ${esc(p.tone||'بدون نبرة')} · <span class="badge">${esc(statusName(p.status))}</span></div></div><div class="actions" style="margin:0"><a class="btn" href="/project/${p.id}">فتح المشروع</a></div></div>`).join('')}</div>`:'<div class="empty">لسه مفيش مشاريع. ابدأ بأول فكرة ليك.</div>'}</div></section>`,user)}
const statusName=s=>({draft:'مسودة',planning:'تخطيط',script:'سيناريو',production:'إنتاج',done:'مكتمل'}[s]||'مسودة');
function projectPage(user,p,script,chars,scenes,videos){
  const videoMap={};
  for(const v of videos||[])if(!videoMap[v.scene_id])videoMap[v.scene_id]=v;
  return page(p.title,`
<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><span class="badge">${esc(statusName(p.status))}</span><h1 style="margin:10px 0 5px">${esc(p.title)}</h1><p class="muted">آخر تحديث: ${esc(p.updated_at||'')}</p></div><div class="actions"><a class="btn" href="/dashboard">رجوع</a><form method="post" action="/project/${p.id}/delete" onsubmit="return confirm('حذف المشروع نهائيًا؟')"><button class="btn danger" type="submit">حذف</button></form></div></div></div>
<div class="tabs" style="margin:16px 0"><a href="#overview">📌 البيانات</a><a href="#script">📝 السيناريو</a><a href="#characters">🎭 الشخصيات</a><a href="#scenes">🎞️ المشاهد</a></div>
<section id="overview" class="card"><h2>بيانات المشروع</h2><form method="post" action="/project/${p.id}/save"><div class="grid2"><div><label class="label">اسم المشروع</label><input class="input" name="title" value="${esc(p.title)}" required maxlength="160"><label class="label">نوع المحتوى</label><input class="input" name="genre" value="${esc(p.genre||'')}" placeholder="فيلم، إعلان، قصة..."></div><div><label class="label">النبرة</label><input class="input" name="tone" value="${esc(p.tone||'')}" placeholder="درامي، كوميدي، مشوق..."><label class="label">اللغة</label><input class="input" name="language" value="${esc(p.language||'')}" placeholder="العربية"></div></div><label class="label">الفكرة الأساسية</label><textarea class="textarea" name="idea" style="min-height:130px" placeholder="اكتب الفكرة بالتفصيل...">${esc(p.idea||'')}</textarea><label class="label">الحالة</label><select class="select" name="status">${['draft','planning','script','production','done'].map(s=>`<option value="${s}" ${p.status===s?'selected':''}>${statusName(s)}</option>`).join('')}</select><div class="actions"><button class="btn primary">حفظ بيانات المشروع</button></div></form></section>
<section id="script" class="card" style="margin-top:16px"><h2>📝 السيناريو</h2><p class="muted">اكتب السيناريو كاملًا وسيتم حفظه في قاعدة البيانات.</p><form method="post" action="/project/${p.id}/script"><textarea class="textarea" name="content" style="min-height:430px" placeholder="المشهد 1...\nالمكان...\nالحوار...">${esc(script?.content||'')}</textarea><div class="actions"><button class="btn primary">حفظ السيناريو</button></div></form></section>
<section id="characters" class="card" style="margin-top:16px"><h2>🎭 الشخصيات</h2><form method="post" action="/project/${p.id}/characters/add"><div class="grid2"><div><label class="label">اسم الشخصية</label><input class="input" name="name" required><label class="label">الدور</label><input class="input" name="role" placeholder="بطل، خصم، مساعد..."></div><div><label class="label">الصفات</label><input class="input" name="traits" placeholder="هادئ، ذكي..."><label class="label">الوصف</label><input class="input" name="description"></div></div><div class="actions"><button class="btn primary">إضافة شخصية</button></div></form><div class="list" style="margin-top:14px">${chars.length?chars.map(c=>`<div class="item"><h4>${esc(c.name)} <span class="badge">${esc(c.role||'')}</span></h4><div class="muted small">${esc(c.description||'')} ${c.traits?'· '+esc(c.traits):''}</div><form method="post" action="/project/${p.id}/characters/${c.id}/delete" style="margin-top:9px"><button class="btn danger" type="submit">حذف</button></form></div>`).join(''):'<div class="empty">أضف أول شخصية للمشروع.</div>'}</div></section>
<section id="scenes" class="card" style="margin-top:16px"><h2>🎞️ المشاهد</h2><p class="muted">كل مشهد يمكن تحويله الآن إلى فيديو تجريبي بالذكاء الاصطناعي.</p><form method="post" action="/project/${p.id}/scenes/add"><div class="grid2"><div><label class="label">رقم المشهد</label><input class="input" type="number" name="scene_number" min="1" value="${scenes.length?Math.max(...scenes.map(x=>Number(x.scene_number)||0))+1:1}" required><label class="label">عنوان المشهد</label><input class="input" name="title"></div><div><label class="label">المكان</label><input class="input" name="location"><label class="label">الوقت</label><input class="input" name="time_of_day" placeholder="ليل / نهار"></div></div><label class="label">الوصف</label><textarea class="textarea" name="description" style="min-height:110px"></textarea><label class="label">الحوار</label><textarea class="textarea" name="dialogue" style="min-height:110px"></textarea><label class="label">Visual Prompt</label><textarea class="textarea" name="visual_prompt" style="min-height:100px" placeholder="وصف بصري واضح للمشهد والحركة والإضاءة والكاميرا..."></textarea><div class="actions"><button class="btn primary">إضافة المشهد</button></div></form><div class="list" style="margin-top:14px">${scenes.length?scenes.map(s=>{
    const v=videoMap[s.id];
    return `<div class="item" id="scene-${s.id}"><h4>المشهد ${esc(s.scene_number)} — ${esc(s.title||'بدون عنوان')}</h4><div class="muted small">${esc(s.location||'')} ${s.time_of_day?'· '+esc(s.time_of_day):''}</div><p>${esc(s.description||'')}</p>${s.dialogue?`<details><summary>الحوار</summary><p>${esc(s.dialogue)}</p></details>`:''}${s.visual_prompt?`<details><summary>Visual Prompt</summary><p>${esc(s.visual_prompt)}</p></details>`:''}
<div class="video-box"><h4 style="margin:0 0 8px">🎬 إنشاء فيديو للمشهد</h4><p class="muted small">سيتم استخدام الوصف البصري + المكان + الوقت + الحركة والحوار لبناء Prompt للفيديو.</p><div class="grid2"><div><label class="label">نسبة الفيديو</label><select class="select" id="ratio-${s.id}"><option value="16:9">16:9 — أفقي</option><option value="9:16">9:16 — رأسي</option></select></div><div><label class="label">مدة الاختبار</label><div class="input" style="opacity:.8">مقطع قصير للتجربة</div></div></div><div class="actions"><button type="button" class="btn primary" onclick="createSceneVideo('${p.id}','${s.id}')">🎬 إنشاء فيديو</button><span id="video-status-${s.id}" class="muted small"></span></div>${v?`<div class="success small" style="margin-top:10px">آخر عملية توليد: ${esc(v.created_at||'')} · ${esc(v.aspect_ratio||'16:9')} · ${esc(v.model||'')}</div>`:''}<video id="video-${s.id}" controls playsinline preload="metadata" style="display:none;width:100%;max-height:520px;margin-top:12px;border-radius:14px;background:#000"></video><a id="download-${s.id}" class="btn primary" href="#" style="display:none;margin-top:10px">⬇️ تنزيل الفيديو</a></div>
<form method="post" action="/project/${p.id}/scenes/${s.id}/delete" style="margin-top:12px"><button class="btn danger" type="submit">حذف المشهد</button></form></div>`}).join(''):'<div class="empty">أضف أول مشهد للمشروع.</div>'}</div></section>
<script>
async function createSceneVideo(projectId,sceneId){
 const btn=event&&event.target?event.target:null, status=document.getElementById('video-status-'+sceneId), video=document.getElementById('video-'+sceneId), ratio=document.getElementById('ratio-'+sceneId).value;
 if(btn){btn.disabled=true;btn.dataset.old=btn.textContent;btn.textContent='⏳ جاري إنشاء الفيديو...'}
 status.textContent='جاري إرسال المشهد إلى محرك الفيديو...'; video.style.display='none'; video.removeAttribute('src');
 try{
  const r=await fetch('/project/'+encodeURIComponent(projectId)+'/scenes/'+encodeURIComponent(sceneId)+'/video',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({aspect_ratio:ratio})});
  if(!r.ok){let msg='تعذر إنشاء الفيديو';try{const d=await r.json();msg=d.detail?((d.error||msg)+' — '+d.detail):(d.error||msg)}catch{}throw new Error(msg)}
  const blob=await r.blob();
  const url=URL.createObjectURL(blob);video.src=url;video.style.display='block';const download=document.getElementById('download-'+sceneId);if(download){download.href=url;download.download='eldab3awy-scene-'+sceneId+'.mp4';download.style.display='inline-flex'}status.textContent='✅ تم إنشاء الفيديو بنجاح — اضغط تنزيل لحفظه على الموبايل';
  video.onloadeddata=()=>{try{video.scrollIntoView({behavior:'smooth',block:'center'})}catch{}};
 }catch(e){status.textContent='❌ '+(e.message||'حدث خطأ أثناء التوليد')}
 finally{if(btn){btn.disabled=false;btn.textContent=btn.dataset.old||'🎬 إنشاء فيديو'}}
}
</script>`,user)
}

async function projectData(env,id,userId){
  const p=await env.DB.prepare('SELECT * FROM projects WHERE id=? AND user_id=?').bind(id,userId).first();
  if(!p)return null;
  const script=await env.DB.prepare('SELECT * FROM scripts WHERE project_id=?').bind(id).first();
  const chars=await env.DB.prepare('SELECT * FROM characters WHERE project_id=? ORDER BY created_at').bind(id).all();
  const scenes=await env.DB.prepare('SELECT * FROM scenes WHERE project_id=? ORDER BY scene_number').bind(id).all();
  const videos=await env.DB.prepare('SELECT * FROM videos WHERE project_id=? ORDER BY created_at DESC').bind(id).all();
  return {p,script,chars:chars.results||[],scenes:scenes.results||[],videos:videos.results||[]}
}

async function createSceneVideo(req,env,projectId,sceneId,userId){
  if(!env.HF_TOKEN)return json({ok:false,error:'خدمة الفيديو غير مفعلة بعد. أضف Secret باسم HF_TOKEN في Cloudflare.'},503);
  const scene=await env.DB.prepare('SELECT s.* FROM scenes s JOIN projects p ON p.id=s.project_id WHERE s.id=? AND s.project_id=? AND p.user_id=?').bind(sceneId,projectId,userId).first();
  if(!scene)return json({ok:false,error:'المشهد غير موجود أو لا تملك هذا المشروع.'},404);
  const b=await body(req);
  const ratio=b.aspect_ratio==='9:16'?'9:16':'16:9';
  const prompt=[
    'Create a short cinematic video scene for an Arabic screenplay.',
    `Aspect ratio composition: ${ratio}.`,
    `Scene title: ${scene.title||'Untitled'}.`,
    `Location: ${scene.location||'unspecified'}.`,
    `Time: ${scene.time_of_day||'unspecified'}.`,
    `Description: ${scene.description||''}.`,
    `Dialogue/context: ${scene.dialogue||''}.`,
    `Visual prompt: ${scene.visual_prompt||''}.`,
    'Cinematic realistic movement, coherent characters, natural camera motion, detailed lighting, no subtitles, no text overlays, no logos, no watermark.'
  ].join('\n');
  const model='Wan-AI/Wan2.1-T2V-1.3B';
  const videoId=uid();
  try{
    await env.DB.prepare('INSERT INTO videos(id,project_id,scene_id,prompt,aspect_ratio,status,model) VALUES(?,?,?,?,?,?,?)').bind(videoId,projectId,sceneId,prompt,ratio,'generating',model).run();
    const client=new InferenceClient(env.HF_TOKEN,{provider:'fal-ai'});
    const output=await client.textToVideo({model,inputs:prompt,num_frames:49,num_inference_steps:20,guidance_scale:5});
    await env.DB.prepare('UPDATE videos SET status=? WHERE id=?').bind('completed',videoId).run();
    return new Response(output,{status:200,headers:{'content-type':'video/mp4','cache-control':'no-store','x-video-id':videoId}});
  }catch(e){
    try{await env.DB.prepare('UPDATE videos SET status=? WHERE id=?').bind('failed',videoId).run()}catch{}
    return json({ok:false,error:'فشل إنشاء الفيديو.',detail:String(e?.message||e),type:String(e?.name||'Error')},502);
  }
}


export default {async fetch(req,env){try{await ensureSchema(env);const u=new URL(req.url),path=u.pathname,method=req.method;const user=await currentUser(req,env);
if(path==='/health')return json({ok:true,service:'eldab3awy-ai',database:'eldab3awy-db',hf_token_configured:Boolean(env.HF_TOKEN),time:now()});
if(path==='/favicon.svg')return new Response(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#f59e0b"/><text x="32" y="43" text-anchor="middle" font-size="34" font-weight="900" font-family="Arial">ض</text></svg>`,{headers:{'content-type':'image/svg+xml'}});
if(path==='/api/me'){if(!user)return json({user:null});return json({user})}
if(path==='/api/projects'){if(!user)return json({error:'غير مسجل'},401);const r=await env.DB.prepare('SELECT id,title,genre,tone,language,status,created_at,updated_at FROM projects WHERE user_id=? ORDER BY updated_at DESC').bind(user.id).all();return json({projects:r.results||[]})}
if(path==='/' )return new Response(home(user),{headers:{'content-type':'text/html; charset=utf-8'}});
if(path==='/register'&&method==='GET')return new Response(authPage('register'),{headers:{'content-type':'text/html; charset=utf-8'}});
if(path==='/login'&&method==='GET')return new Response(authPage('login'),{headers:{'content-type':'text/html; charset=utf-8'}});
if(path==='/logout'){if(user){const raw=cookies(req)[COOKIE];if(raw)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha(raw)).run()}return redirect('/',{'Set-Cookie':clearCookie()})}
if((path==='/register'||path==='/login')&&method==='POST'){const form=await req.formData();const email=String(form.get('email')||'').trim().toLowerCase();const password=String(form.get('password')||'');if(!email||password.length<8)return new Response(authPage(path==='/register'?'register':'login','تأكد من البريد وكلمة المرور (8 أحرف على الأقل).'),{status:400,headers:{'content-type':'text/html; charset=utf-8'}});if(path==='/register'){const name=String(form.get('name')||'').trim();if(name.length<2)return new Response(authPage('register','اكتب اسمًا صحيحًا.'),{status:400,headers:{'content-type':'text/html; charset=utf-8'}});const exists=await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();if(exists)return new Response(authPage('register','البريد الإلكتروني مستخدم بالفعل.'),{status:409,headers:{'content-type':'text/html; charset=utf-8'}});const id=uid();await env.DB.prepare('INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)').bind(id,name,email,await sha(password)).run();const token=await createSession(id,env);return redirect('/dashboard',{'Set-Cookie':setCookie(token)})}const found=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();if(!found||found.password_hash!==await sha(password))return new Response(authPage('login','البريد الإلكتروني أو كلمة المرور غير صحيحة.'),{status:401,headers:{'content-type':'text/html; charset=utf-8'}});const token=await createSession(found.id,env);return redirect('/dashboard',{'Set-Cookie':setCookie(token)})}
if(path==='/dashboard'){if(!user)return redirect('/login');const r=await env.DB.prepare('SELECT * FROM projects WHERE user_id=? ORDER BY updated_at DESC').bind(user.id).all();return new Response(dashboard(user,r.results||[]),{headers:{'content-type':'text/html; charset=utf-8'}})}
if(path==='/project/new'){if(!user)return redirect('/login');if(method==='GET')return new Response(page('مشروع جديد',`<div class="card form"><h1>🎬 مشروع جديد</h1><p class="muted">ابدأ من الفكرة، وبعدها نكمل السيناريو والمشاهد والشخصيات.</p><form method="post"><label class="label">اسم المشروع</label><input class="input" name="title" required maxlength="160" placeholder="مثال: آخر رسالة"><label class="label">الفكرة</label><textarea class="textarea" name="idea" placeholder="ما الذي تريد صنعه؟"></textarea><div class="grid2"><div><label class="label">النوع</label><input class="input" name="genre" placeholder="دراما، كوميديا..."></div><div><label class="label">النبرة</label><input class="input" name="tone" placeholder="مشوق، عاطفي..."></div></div><label class="label">اللغة</label><input class="input" name="language" value="العربية"><div class="actions"><button class="btn primary">إنشاء المشروع</button><a class="btn" href="/dashboard">إلغاء</a></div></form></div>`,user),{headers:{'content-type':'text/html; charset=utf-8'}});const f=await req.formData(),title=String(f.get('title')||'').trim();if(!title)return redirect('/project/new');const id=uid(),t=now();await env.DB.prepare('INSERT INTO projects(id,user_id,title,idea,genre,tone,language,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,user.id,title,String(f.get('idea')||''),String(f.get('genre')||''),String(f.get('tone')||''),String(f.get('language')||'العربية'),t).run();await env.DB.prepare('INSERT INTO scripts(id,project_id,content) VALUES(?,?,?)').bind(uid(),id,'').run();return redirect('/project/'+id)}
const m=path.match(/^\/project\/([^/]+)(?:\/(.*))?$/);if(m){if(!user)return redirect('/login');const id=m[1],action=m[2]||'';const data=await projectData(env,id,user.id);if(!data)return new Response(page('غير موجود','<div class="card"><h1>المشروع غير موجود</h1><a class="btn" href="/dashboard">العودة</a></div>',user),{status:404,headers:{'content-type':'text/html; charset=utf-8'}});
if(method==='GET'&&!action)return new Response(projectPage(user,data.p,data.script,data.chars,data.scenes,data.videos),{headers:{'content-type':'text/html; charset=utf-8'}});
if(method==='POST'&&action==='save'){const f=await req.formData();await env.DB.prepare('UPDATE projects SET title=?,idea=?,genre=?,tone=?,language=?,status=?,updated_at=? WHERE id=? AND user_id=?').bind(String(f.get('title')||'').trim()||data.p.title,String(f.get('idea')||''),String(f.get('genre')||''),String(f.get('tone')||''),String(f.get('language')||'العربية'),['draft','planning','script','production','done'].includes(String(f.get('status'))) ? String(f.get('status')):'draft',now(),id,user.id).run();return redirect('/project/'+id+'#overview')}
if(method==='POST'&&action==='script'){const f=await req.formData();await env.DB.prepare('UPDATE scripts SET content=?,version=COALESCE(version,0)+1,updated_at=? WHERE project_id=?').bind(String(f.get('content')||''),now(),id).run();await env.DB.prepare('UPDATE projects SET status=?,updated_at=? WHERE id=?').bind('script',now(),id).run();return redirect('/project/'+id+'#script')}
if(method==='POST'&&action==='delete'){await env.DB.prepare('DELETE FROM videos WHERE project_id=?').bind(id).run();await env.DB.prepare('DELETE FROM scenes WHERE project_id=?').bind(id).run();await env.DB.prepare('DELETE FROM characters WHERE project_id=?').bind(id).run();await env.DB.prepare('DELETE FROM scripts WHERE project_id=?').bind(id).run();await env.DB.prepare('DELETE FROM projects WHERE id=? AND user_id=?').bind(id,user.id).run();return redirect('/dashboard')}
let cm=action.match(/^characters\/([^/]+)\/delete$/);if(method==='POST'&&cm){await env.DB.prepare('DELETE FROM characters WHERE id=? AND project_id=?').bind(cm[1],id).run();return redirect('/project/'+id+'#characters')}
if(method==='POST'&&action==='characters/add'){const f=await req.formData();const name=String(f.get('name')||'').trim();if(name)await env.DB.prepare('INSERT INTO characters(id,project_id,name,role,description,traits) VALUES(?,?,?,?,?,?)').bind(uid(),id,name,String(f.get('role')||''),String(f.get('description')||''),String(f.get('traits')||'')).run();return redirect('/project/'+id+'#characters')}
let vm=action.match(/^scenes\/([^/]+)\/video$/);if(method==='POST'&&vm)return await createSceneVideo(req,env,id,vm[1],user.id);
let sm=action.match(/^scenes\/([^/]+)\/delete$/);if(method==='POST'&&sm){await env.DB.prepare('DELETE FROM videos WHERE scene_id=? AND project_id=?').bind(sm[1],id).run();await env.DB.prepare('DELETE FROM scenes WHERE id=? AND project_id=?').bind(sm[1],id).run();return redirect('/project/'+id+'#scenes')}
if(method==='POST'&&action==='scenes/add'){const f=await req.formData();const n=Math.max(1,parseInt(String(f.get('scene_number')||'1'),10)||1);await env.DB.prepare('INSERT INTO scenes(id,project_id,scene_number,title,location,time_of_day,description,dialogue,visual_prompt) VALUES(?,?,?,?,?,?,?,?,?)').bind(uid(),id,n,String(f.get('title')||''),String(f.get('location')||''),String(f.get('time_of_day')||''),String(f.get('description')||''),String(f.get('dialogue')||''),String(f.get('visual_prompt')||'')).run();return redirect('/project/'+id+'#scenes')}
}
return isApi(req)?json({error:'Not found'},404):new Response(page('404','<div class="card"><h1>الصفحة غير موجودة</h1><a class="btn" href="/">الرئيسية</a></div>',user),{status:404,headers:{'content-type':'text/html; charset=utf-8'}});
}catch(e){return json({error:'Server error',detail:String(e?.message||e)},500)}}};
