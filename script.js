/* script.js — Simple Version: localStorage auth + per-user events + theme + bell */

/* ---------- Utilities ---------- */
function _getUsersObj(){ return JSON.parse(localStorage.getItem('users') || '{}'); }
function _setUsersObj(obj){ localStorage.setItem('users', JSON.stringify(obj)); }
function _currentUserEmail(){ return localStorage.getItem('currentUser') || null; }
function _setCurrentUser(email){ if (!email) localStorage.removeItem('currentUser'); else localStorage.setItem('currentUser', email); }
function genId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function formatDate(iso){ const d=new Date(iso); if (isNaN(d)) return iso; return d.toLocaleString(); }
function toLocalInputValue(iso){ const dt = new Date(iso); if (isNaN(dt)) return ''; const tz = dt.getTimezoneOffset()*60000; return new Date(dt.getTime()-tz).toISOString().slice(0,16); }
function escapeHtml(s){ return (s+'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ---------- THEME ---------- */
const THEME_KEY = 'themeMode';
function initTheme(){
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) applyTheme(stored);
    else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    }
  } catch(e){ applyTheme('light'); }
  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', toggleTheme);
  updateThemeButtonIcon();
}
function applyTheme(mode){
  if (mode === 'dark') document.body.classList.add('dark-theme'); else document.body.classList.remove('dark-theme');
  try{ localStorage.setItem(THEME_KEY, mode);}catch(e){}
  updateThemeButtonIcon();
}
function toggleTheme(){ const isDark = document.body.classList.contains('dark-theme'); applyTheme(isDark ? 'light' : 'dark'); }
function updateThemeButtonIcon(){ const btn = document.getElementById('themeToggle'); if (!btn) return; btn.textContent = document.body.classList.contains('dark-theme') ? '☀️' : '🌙'; }

/* ---------- SOUND (soft bell via WebAudio) ---------- */
let audioCtx = null;
function playDing(){
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    const master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.6, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 880;
    const g1 = ctx.createGain(); g1.gain.value = 0.8; o1.connect(g1); g1.connect(master);
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 1320;
    const g2 = ctx.createGain(); g2.gain.value = 0.4; o2.connect(g2); g2.connect(master);

    o1.frequency.setValueAtTime(980, now); o1.frequency.exponentialRampToValueAtTime(880, now + 0.6);
    o2.frequency.setValueAtTime(1320, now); o2.frequency.exponentialRampToValueAtTime(1200, now + 0.9);

    o1.start(now); o2.start(now); o1.stop(now + 1.8); o2.stop(now + 1.8);
  } catch(e){ console.warn('Audio blocked or failed', e); }
}

/* ---------- AUTH ---------- */
function signupUser(fullName, email, password){
  const users = _getUsersObj(); const e = email.toLowerCase();
  if (users[e]) return {ok:false, error:'Email already registered.'};
  users[e] = { name: fullName, email: e, password: password, events: [] };
  _setUsersObj(users); _setCurrentUser(e); return {ok:true};
}
function loginUser(email, password){
  const users = _getUsersObj(); const e = email.toLowerCase();
  if (!users[e]) return {ok:false, error:'No account with this email.'};
  if (users[e].password !== password) return {ok:false, error:'Incorrect password.'};
  _setCurrentUser(e); return {ok:true};
}
function logoutUser(){ _setCurrentUser(null); window.location.href = 'login.html'; }
function currentUser(){ const e = _currentUserEmail(); if (!e) return null; const users = _getUsersObj(); return users[e] ? users[e] : null; }

/* ---------- EVENTS (per-user) ---------- */
function getUserEvents(){ const u = currentUser(); if (!u) return []; return u.events || []; }
function setUserEvents(arr){ const e = _currentUserEmail(); if (!e) return; const users = _getUsersObj(); users[e].events = arr; _setUsersObj(users); }
function addEventForCurrentUser(title, isoDate){ const ev = { id: genId(), title, date: isoDate }; const arr = getUserEvents(); arr.push(ev); setUserEvents(arr); return ev.id; }
function updateEventForCurrentUser(id, newTitle, newDate){ const arr = getUserEvents(); const idx = arr.findIndex(x=> x.id===id); if (idx!==-1){ arr[idx].title=newTitle; arr[idx].date=newDate; setUserEvents(arr); return true;} return false; }
function deleteEventForCurrentUser(id){ let arr=getUserEvents(); arr = arr.filter(x=> x.id!==id); setUserEvents(arr); }

/* ---------- Password strength helper ---------- */
function passwordStrength(pw){ let score=0; if (!pw) return {score:0,label:'Empty'}; if (pw.length>=8) score++; if (/[A-Z]/.test(pw)) score++; if (/[0-9]/.test(pw)) score++; if (/[^A-Za-z0-9]/.test(pw)) score++; const labels=['Very weak','Weak','Medium','Strong','Very strong']; return {score, label: labels[score] || 'Weak'}; }

/* ---------- Require auth (protect pages) ---------- */
function requireAuth(){ if (!_currentUserEmail()){ window.location.href='login.html'; return false; } return true; }

/* ---------- Signup page wiring ---------- */
function initSignupPage(){
  initTheme();
  const form=document.getElementById('signupForm');
  const nameIn=document.getElementById('suName'); const emailIn=document.getElementById('suEmail');
  const pwIn=document.getElementById('suPassword'); const pw2In=document.getElementById('suPassword2');
  const strengthBar=document.getElementById('pwStrengthBar'); const strengthLabel=document.getElementById('pwStrengthLabel');
  const toggleBtns=document.querySelectorAll('.toggle-pw');
  toggleBtns.forEach(btn=> btn.addEventListener('click', ()=> { const target=document.getElementById(btn.dataset.target); if(!target) return; target.type = target.type==='password' ? 'text' : 'password'; btn.textContent = (target.type==='password') ? 'Show' : 'Hide'; }));
  pwIn.addEventListener('input', ()=>{ const res=passwordStrength(pwIn.value); const w = Math.min(100, (res.score/4)*100); strengthBar.style.width = w + '%'; strengthLabel.textContent = res.label;});
  form.addEventListener('submit', (e)=>{ e.preventDefault(); const name=nameIn.value.trim(); const email=emailIn.value.trim().toLowerCase(); const pw=pwIn.value; const pw2=pw2In.value; if(!name||!email||!pw||!pw2) return alert('Please fill all fields.'); if(pw!==pw2) return alert('Passwords do not match.'); const res = signupUser(name,email,pw); if(!res.ok) return alert(res.error); window.location.href='index.html'; });
}

/* ---------- Login page wiring ---------- */
function initLoginPage(){
  initTheme();
  const form=document.getElementById('loginForm'); const emailIn=document.getElementById('liEmail'); const pwIn=document.getElementById('liPassword');
  const toggle=document.querySelector('.toggle-pw');
  if(toggle) toggle.addEventListener('click', ()=>{ pwIn.type = pwIn.type==='password' ? 'text' : 'password'; toggle.textContent = (pwIn.type==='password') ? 'Show' : 'Hide';});
  form.addEventListener('submit', (e)=>{ e.preventDefault(); const email=emailIn.value.trim().toLowerCase(); const pw=pwIn.value; if(!email||!pw) return alert('Enter email and password'); const res=loginUser(email,pw); if(!res.ok) return alert(res.error); window.location.href='index.html'; });
}

/* ---------- Index page wiring (add event + quick preview) ---------- */
function initIndexPage(){
  initTheme();
  if(!requireAuth()) return;
  const user = currentUser();
  const userElem=document.getElementById('userNameDisplay'); if(userElem) userElem.textContent = user.name || user.email;
  const logoutBtn=document.getElementById('logoutBtn'); if(logoutBtn) logoutBtn.addEventListener('click', ()=> logoutUser());
  const form=document.getElementById('addForm'); const titleIn=document.getElementById('titleInput'); const dateIn=document.getElementById('dateInput');
  form.addEventListener('submit', (e)=>{ e.preventDefault(); const title=titleIn.value.trim(); const date=dateIn.value; if(!title||!date) return alert('Enter title and date'); addEventForCurrentUser(title,date); startQuickPreview({title,date}); form.reset(); alert('Event saved'); });
  const m = window.location.hash.match(/event=([^&]+)/); if(m){ const id=m[1]; const ev=getUserEvents().find(x=>x.id===id); if(ev) startQuickPreview(ev); }
  // quick preview
  let qpInterval=null;
  function el(id){ return document.getElementById(id); }
  function startQuickPreview(ev){
    clearInterval(qpInterval); const preview=document.getElementById('quickPreview'); el('qpTitle').innerText = ev.title; preview.classList.remove('hidden');
    let played=false;
    function update(){ const now=Date.now(); const target=new Date(ev.date).getTime(); let d = target - now;
      if(d<=0){ el('qpDays').innerText='0'; el('qpHours').innerText='0'; el('qpMinutes').innerText='0'; el('qpSeconds').innerText='0'; clearInterval(qpInterval); if(!played){ playDing(); played=true;} return; }
      const days = Math.floor(d/(1000*60*60*24));
      const hours = Math.floor((d%(1000*60*60*24))/(1000*60*60));
      const minutes = Math.floor((d%(1000*60*60))/(1000*60));
      const seconds = Math.floor((d%(1000*60))/1000);
      el('qpDays').innerText=days; el('qpHours').innerText=hours; el('qpMinutes').innerText=minutes; el('qpSeconds').innerText=seconds;
    }
    update(); qpInterval = setInterval(update,1000);
  }
  window.startQuickPreview = startQuickPreview;
}

/* ---------- Events page wiring (render, live updates, edit, delete, search, sort) ---------- */
function initEventsPage(){
  initTheme();
  if(!requireAuth()) return;
  const user = currentUser(); const userElem=document.getElementById('userNameDisplay'); if(userElem) userElem.textContent = user.name || user.email;
  const logoutBtn=document.getElementById('logoutBtn'); if(logoutBtn) logoutBtn.addEventListener('click', ()=> logoutUser());
  const eventsList=document.getElementById('eventsList'); const noEvents=document.getElementById('noEvents'); const search=document.getElementById('search'); const sort=document.getElementById('sort');
  const modal=document.getElementById('modal'); const modalForm=document.getElementById('modalForm'); const modalEventTitle=document.getElementById('modalEventTitle'); const modalEventDate=document.getElementById('modalEventDate'); const cancelBtn=document.getElementById('cancelBtn');
  let editingId=null; let updateTimer=null;

  function render(){
    const q = (search?.value || '').trim().toLowerCase();
    let events = getUserEvents().slice();
    if(q) events = events.filter(ev => ev.title.toLowerCase().includes(q));
    const s = sort?.value || 'time-asc';
    if(s==='time-asc') events.sort((a,b)=> new Date(a.date) - new Date(b.date));
    else if(s==='time-desc') events.sort((a,b)=> new Date(b.date) - new Date(a.date));
    else if(s==='alpha-asc') events.sort((a,b)=> a.title.localeCompare(b.title));
    else if(s==='alpha-desc') events.sort((a,b)=> b.title.localeCompare(a.title));
    eventsList.innerHTML = ''; if(!events.length){ noEvents.style.display='block'; return; } else noEvents.style.display='none';
    events.forEach(ev=>{
      const card = document.createElement('div'); card.className='event-item'; card.dataset.id = ev.id;
      const header = document.createElement('div'); header.className='event-row';
      header.innerHTML = `<div><div class="title-small">${escapeHtml(ev.title)}</div><div class="date-small">${formatDate(ev.date)}</div></div><div class="controls-inline"><button class="icon-btn edit-btn" title="Edit">✏️</button><button class="icon-btn delete-btn" title="Delete">🗑️</button></div>`;
      const expanded = document.createElement('div'); expanded.className='expanded';
      expanded.innerHTML = `<div class="live-count"><div class="time"><span data-days>0</span><p>Days</p></div><div class="time"><span data-hours>0</span><p>Hours</p></div><div class="time"><span data-minutes>0</span><p>Minutes</p></div><div class="time"><span data-seconds>0</span><p>Seconds</p></div></div><div class="card-actions"><button class="small-btn open-btn">Open in Main</button><button class="small-btn copy-btn">Copy Link</button></div>`;
      card.appendChild(header); card.appendChild(expanded); eventsList.appendChild(card);

      header.querySelector('.edit-btn').addEventListener('click', (e)=>{ e.stopPropagation(); openEditModal(ev); });
      header.querySelector('.delete-btn').addEventListener('click', (e)=>{ e.stopPropagation(); if(confirm(`Delete "${ev.title}"?`)){ deleteEventForCurrentUser(ev.id); render(); } });

      expanded.querySelector('.open-btn').addEventListener('click', (e)=>{ e.stopPropagation(); window.location.href = `index.html#event=${ev.id}`; });
      expanded.querySelector('.copy-btn').addEventListener('click', (e)=>{ e.stopPropagation(); navigator.clipboard?.writeText(window.location.href.split('#')[0] + '#event=' + ev.id).then(()=>alert('Link copied')).catch(()=>alert('Copy failed')); });

      card.addEventListener('click', function(){ if(card.classList.contains('expanded')) card.classList.remove('expanded'); else card.classList.add('expanded'); });
    });
  }

  function updateAll(){
    const now = Date.now();
    document.querySelectorAll('.event-item').forEach(card=>{
      const id = card.dataset.id;
      const ev = getUserEvents().find(x=>x.id===id);
      if(!ev) return;
      const target = new Date(ev.date).getTime();
      let d = target - now;
      const daysEl = card.querySelector('[data-days]'); const hoursEl = card.querySelector('[data-hours]'); const minsEl = card.querySelector('[data-minutes]'); const secsEl = card.querySelector('[data-seconds]');
      if(!card.dataset.played) card.dataset.played = 'false';
      if(d<=0){
        daysEl.textContent='0'; hoursEl.textContent='0'; minsEl.textContent='0'; secsEl.textContent='0'; card.style.opacity='0.85';
        if(card.dataset.played === 'false'){ playDing(); card.dataset.played='true'; }
      } else {
        card.style.opacity='1';
        const days = Math.floor(d/(1000*60*60*24));
        const hours = Math.floor((d%(1000*60*60*24))/(1000*60*60));
        const minutes = Math.floor((d%(1000*60*60))/(1000*60));
        const seconds = Math.floor((d%(1000*60))/1000);
        daysEl.textContent=days; hoursEl.textContent=hours; minsEl.textContent=minutes; secsEl.textContent=seconds;
        if(card.dataset.played === 'true') card.dataset.played='false';
      }
    });
  }

  search?.addEventListener('input', debounce(render,250)); sort?.addEventListener('change', render);

  function openEditModal(ev){ editingId = ev.id; modalEventTitle.value = ev.title; modalEventDate.value = toLocalInputValue(ev.date); modal.classList.remove('hidden'); }
  cancelBtn.addEventListener('click', ()=>{ modal.classList.add('hidden'); editingId=null; });
  modalForm.addEventListener('submit', (e)=>{ e.preventDefault(); const t = modalEventTitle.value.trim(); const d = modalEventDate.value; if(!t||!d) return alert('Both required'); updateEventForCurrentUser(editingId,t,d); modal.classList.add('hidden'); editingId=null; render(); });

  if(updateTimer) clearInterval(updateTimer); updateTimer = setInterval(updateAll,1000);
  render();
}

/* ---------- Helpers ---------- */
function debounce(fn, wait){ let t; return (...a)=>{ clearTimeout(t); t = setTimeout(()=> fn(...a), wait); }; }

/* ---------- Auto init ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  initTheme();
  if(document.getElementById('signupForm')) initSignupPage();
  if(document.getElementById('loginForm')) initLoginPage();
  if(document.getElementById('addForm')) initIndexPage();
  if(document.getElementById('eventsList')) initEventsPage();
});
