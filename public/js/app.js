/* Chata pod Havranom — frontend logic.
   All data now lives on the server (server/data.json) and is shared by every
   visitor. The admin password lives only on the server too — this file never
   contains it. */

const MONTHS = ['Január','Február','Marec','Apríl','Máj','Jún','Júl','August','September','Október','November','December'];

let SITE = { heroTitle:'', heroTagline:'', aboutText:'', basePrice:120 };
let GALLERY = [];
let DEALS = [];
let PRICE_RULES = [];
let BLOCKS = [];        // public view: {start,end,status} only
let ADMIN_BLOCKS = [];  // admin view: full objects with id/ref/note
let ADMIN_NEWSLETTER = [];

let calYear, calMonth;
let selection = {start:null, end:null};
let isAdmin = false;

/* ---------- tiny API helper ---------- */
async function api(method, url, body, isForm){
  const opts = { method, credentials:'same-origin' };
  if(body){
    if(isForm){ opts.body = body; }
    else { opts.headers = {'Content-Type':'application/json'}; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(url, opts);
  let data = null;
  try{ data = await res.json(); }catch(e){}
  if(!res.ok){ throw new Error((data && data.error) || `Chyba servera (${res.status})`); }
  return data;
}

/* ---------- routing ---------- */
function navigate(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('nav.links a').forEach(a=>a.classList.toggle('active', a.dataset.page===page));
  document.getElementById('navLinks').classList.remove('open');
  window.scrollTo(0,0);
  location.hash = page;
}
window.addEventListener('hashchange', ()=>{
  const p = location.hash.replace('#','');
  if(['home','calendar','gallery','nearby','contact'].includes(p)) navigate(p);
});

/* ---------- loading public state ---------- */
async function loadState(){
  try{
    const data = await api('GET', '/api/state');
    SITE = data.site; GALLERY = data.gallery; DEALS = data.deals; PRICE_RULES = data.pricing; BLOCKS = data.blocks;
  }catch(e){
    console.error('Could not load site data — is the server running?', e);
    document.body.insertAdjacentHTML('afterbegin',
      `<div style="background:#f6e3df;color:#8a3a2d;padding:14px 20px;font-size:0.9rem;text-align:center;">
        Nepodarilo sa načítať dáta zo servera. Skontrolujte, či beží (npm start v priečinku server), a obnovte stránku.
      </div>`);
    return;
  }
  renderAll();
}
async function refreshPublicState(){
  try{
    const data = await api('GET', '/api/state');
    SITE = data.site; GALLERY = data.gallery; DEALS = data.deals; PRICE_RULES = data.pricing; BLOCKS = data.blocks;
    renderAll();
  }catch(e){ console.error(e); }
}

function renderAll(){
  document.getElementById('heroTitle').textContent = SITE.heroTitle;
  document.getElementById('heroTagline').textContent = SITE.heroTagline;
  document.getElementById('aboutText').textContent = SITE.aboutText;
  document.getElementById('aboutPrice').textContent = SITE.basePrice + " €/noc";
  renderGallery();
  renderDeals();
  renderCalendar();
}

/* ---------- gallery (public) ---------- */
function renderGallery(){
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = "";
  GALLERY.forEach((g,i)=>{
    const fig = document.createElement('figure');
    if(i===0) fig.classList.add('big');
    fig.style.cssText = g.url ? `background-image:url('${g.url}'); background-size:cover; background-position:center;` : `background:${g.tone||'#5B6F5C'};`;
    fig.onclick = ()=>openLightbox(g.url, g.caption);
    const cap = document.createElement('figcaption'); cap.textContent = g.caption || "";
    fig.appendChild(cap); grid.appendChild(fig);
  });
}
function openLightbox(url, caption){
  const img = document.getElementById('lightboxImg');
  if(url){ img.src = url; img.style.display='block'; } else { img.style.display='none'; }
  document.getElementById('lightboxCap').textContent = caption || "";
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox(){ document.getElementById('lightbox').classList.remove('open'); }

/* ---------- deals (public) ---------- */
function renderDeals(){
  const wrap = document.getElementById('dealCards');
  wrap.innerHTML = "";
  if(!DEALS.length){ wrap.innerHTML = '<p class="no-deals">Momentálne žiadne last-minute ponuky.</p>'; return; }
  DEALS.forEach(d=>{
    const price = SITE.basePrice * (1 - (d.discount||0)/100);
    const card = document.createElement('div'); card.className = 'deal-card';
    card.innerHTML = `<span class="tag">-${d.discount||0}%</span><h3>${d.title}</h3><div class="dates">${fmtShort(d.start)} – ${fmtShort(d.end)}${d.note ? ' · '+d.note : ''}</div><div class="price-line"><span class="old">${SITE.basePrice} €</span><span class="new">${price.toFixed(0)} €/noc</span></div>`;
    wrap.appendChild(card);
  });
}

/* ---------- calendar / pricing core ---------- */
function pad(n){ return n<10 ? '0'+n : ''+n; }
function toISO(y,m,d){ return `${y}-${pad(m+1)}-${pad(d)}`; }
function todayISO(){ const t=new Date(); return toISO(t.getFullYear(), t.getMonth(), t.getDate()); }
function getBlockForDate(iso){ return BLOCKS.find(b => iso >= b.start && iso < b.end); }
function getPriceRuleForDate(iso){
  for(let i=PRICE_RULES.length-1; i>=0; i--){ const r = PRICE_RULES[i]; if(iso >= r.start && iso < r.end) return r; }
  return null;
}
function getNightPrice(iso){ const r = getPriceRuleForDate(iso); return r ? r.price : SITE.basePrice; }
function isRangeFree(startISO, endISO){
  let d = new Date(startISO); const end = new Date(endISO);
  while(d < end){ const iso = toISO(d.getFullYear(), d.getMonth(), d.getDate()); if(getBlockForDate(iso)) return false; d.setDate(d.getDate()+1); }
  return true;
}
function calcTotal(startISO, endISO){
  let d = new Date(startISO); const end = new Date(endISO); let total = 0;
  while(d < end){ total += getNightPrice(toISO(d.getFullYear(), d.getMonth(), d.getDate())); d.setDate(d.getDate()+1); }
  return total;
}
function shiftMonth(delta){
  calMonth += delta;
  if(calMonth<0){calMonth=11; calYear--;}
  if(calMonth>11){calMonth=0; calYear++;}
  renderCalendar();
}
function renderCalendar(){
  if(calYear === undefined){ const t = new Date(); calYear = t.getFullYear(); calMonth = t.getMonth(); }
  document.getElementById('calMonthLabel').textContent = MONTHS[calMonth] + ' ' + calYear;
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  const first = new Date(calYear, calMonth, 1);
  let startOffset = first.getDay(); startOffset = (startOffset === 0) ? 6 : startOffset - 1;
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const tISO = todayISO();

  for(let i=0;i<startOffset;i++){ const blank = document.createElement('div'); blank.className = 'cal-day blank'; grid.appendChild(blank); }
  for(let d=1; d<=daysInMonth; d++){
    const iso = toISO(calYear, calMonth, d);
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = d;
    const block = getBlockForDate(iso);
    const isPast = iso < tISO;
    let inSelection = false;
    if(selection.start && !selection.end && iso === selection.start) inSelection = true;
    if(selection.start && selection.end && iso >= selection.start && iso < selection.end) inSelection = true;

    if(isPast){ cell.classList.add('past'); }
    else if(block){ cell.classList.add(block.status); }
    else { cell.classList.add('available'); cell.onclick = ()=>onDayClick(iso); }

    if(!isPast && !block){
      const price = getNightPrice(iso);
      cell.title = price + ' €/noc';
      if(price > SITE.basePrice){ const dot = document.createElement('span'); dot.className='price-dot'; dot.style.background='var(--season-high)'; cell.appendChild(dot); }
      else if(price < SITE.basePrice){ const dot = document.createElement('span'); dot.className='price-dot'; dot.style.background='var(--season-low)'; cell.appendChild(dot); }
    }
    if(inSelection) cell.classList.add('selected');
    if(iso === tISO) cell.classList.add('today');
    grid.appendChild(cell);
  }
  updateSelectionBar();
}
function onDayClick(iso){
  if(!selection.start || selection.end){ selection = {start: iso, end: null}; }
  else if(iso <= selection.start){ selection = {start: iso, end: null}; }
  else {
    if(isRangeFree(selection.start, iso)){ selection.end = iso; }
    else { alert('Vybraný rozsah obsahuje už obsadené alebo blokované dni. Skúste iný rozsah.'); selection = {start: iso, end: null}; }
  }
  renderCalendar();
}
function clearSelection(){ selection = {start:null,end:null}; renderCalendar(); }
function nightsCount(){ if(!selection.start || !selection.end) return 0; return Math.round((new Date(selection.end) - new Date(selection.start)) / 86400000); }
function fmtShort(iso){ const [y,m,d] = iso.split('-'); return `${d}.${m}.${y}`; }

function updateSelectionBar(){
  const bar = document.getElementById('selectionBar');
  const submitBtn = document.getElementById('bkSubmitBtn');
  if(selection.start && selection.end){
    const n = nightsCount();
    bar.classList.remove('empty');
    bar.innerHTML = `<span>Vybraný termín: <b>${fmtShort(selection.start)} – ${fmtShort(selection.end)}</b> (${n} ${n===1?'noc':n<5?'noci':'nocí'})</span><button class="link" onclick="clearSelection()">Zrušiť výber</button>`;
    submitBtn.disabled = false; submitBtn.textContent = 'Odoslať žiadosť o rezerváciu';
  } else if(selection.start){
    bar.classList.add('empty'); bar.textContent = `Príchod: ${fmtShort(selection.start)} — teraz kliknite na deň odchodu.`;
    submitBtn.disabled = true; submitBtn.textContent = 'Najprv vyberte termín v kalendári';
  } else {
    bar.classList.add('empty'); bar.textContent = 'Zatiaľ ste nevybrali žiadny termín.';
    submitBtn.disabled = true; submitBtn.textContent = 'Najprv vyberte termín v kalendári';
  }
  const n = nightsCount();
  document.getElementById('sumDates').textContent = (selection.start && selection.end) ? `${fmtShort(selection.start)} – ${fmtShort(selection.end)}` : '–';
  document.getElementById('sumNights').textContent = n || '–';
  const note = document.getElementById('sumNote');
  if(n){
    const total = calcTotal(selection.start, selection.end);
    document.getElementById('sumTotal').textContent = total.toFixed(0) + ' €';
    const avg = total / n;
    note.textContent = Math.abs(avg - SITE.basePrice) > 0.5 ? `Priemerná cena ${avg.toFixed(0)} €/noc — termín obsahuje sezónnu cenu.` : `${SITE.basePrice} €/noc, bez sezónnej úpravy.`;
  } else {
    document.getElementById('sumTotal').textContent = '–';
    note.textContent = '';
  }
}

/* ---------- booking submit ---------- */
async function submitBooking(){
  if(!selection.start || !selection.end) return;
  const name = document.getElementById('bkName').value.trim();
  const email = document.getElementById('bkEmail').value.trim();
  const guests = document.getElementById('bkGuests').value;
  const phone = document.getElementById('bkPhone').value.trim();
  const msg = document.getElementById('bkMsg').value.trim();
  const box = document.getElementById('bookingMsg');
  if(!name || !email){ box.className = 'form-msg err'; box.textContent = 'Vyplňte prosím meno a e-mail.'; return; }

  try{
    const result = await api('POST', '/api/reservations', {
      name, email, phone, guests, start:selection.start, end:selection.end, msg
    });
    box.className = 'form-msg ok';
    box.innerHTML = result.emailSent
      ? `Žiadosť odoslaná e-mailom, termín je dočasne pridržaný. Váš kód rezervácie: <span class="ref-code">${result.ref}</span>.`
      : `Termín je dočasne pridržaný (kód <span class="ref-code">${result.ref}</span>). Automatický e-mail sa nepodarilo odoslať — server ešte nemá nastavené SMTP (pozri README na serveri).`;
    ['bkName','bkEmail','bkPhone','bkMsg'].forEach(i=>document.getElementById(i).value='');
    selection = {start:null,end:null};
    await refreshPublicState();
  }catch(e){
    box.className = 'form-msg err';
    box.textContent = e.message || 'Nepodarilo sa odoslať žiadosť, skúste znova.';
    if(String(e.message).includes('obsadený')) refreshPublicState();
  }
}

/* ---------- newsletter / contact ---------- */
async function submitNewsletter(){
  const email = document.getElementById('newsletterEmail').value.trim();
  const box = document.getElementById('newsletterMsg');
  try{
    await api('POST', '/api/newsletter', {email});
    box.textContent = 'Hotovo — dáme vám vedieť o nových termínoch.'; box.style.color = '#EFE6C9';
    document.getElementById('newsletterEmail').value = '';
  }catch(e){
    box.textContent = e.message || 'Nepodarilo sa uložiť, skúste znova.'; box.style.color = '#F3D8CE';
  }
}
async function submitContact(){
  const name = document.getElementById('ctName').value.trim();
  const email = document.getElementById('ctEmail').value.trim();
  const message = document.getElementById('ctMsg').value.trim();
  const box = document.getElementById('contactMsg');
  if(!name || !email || !message){ box.className='form-msg err'; box.textContent='Vyplňte prosím všetky polia.'; return; }
  try{
    const result = await api('POST', '/api/contact', {name, email, message});
    box.className = result.emailSent ? 'form-msg ok' : 'form-msg warn';
    box.textContent = result.emailSent ? 'Správa odoslaná, ozveme sa čo najskôr.' : 'Uložené, ale automatický e-mail sa nepodarilo odoslať — server ešte nemá nastavené SMTP.';
    ['ctName','ctEmail','ctMsg'].forEach(i=>document.getElementById(i).value='');
  }catch(e){
    box.className = 'form-msg err'; box.textContent = e.message || 'Nepodarilo sa odoslať správu.';
  }
}

/* ---------- admin ---------- */
function openAdmin(){ document.getElementById('adminOverlay').classList.add('open'); }
function closeAdmin(){ document.getElementById('adminOverlay').classList.remove('open'); }

async function checkAdminSession(){
  try{
    const res = await api('GET', '/api/admin/check');
    if(res.isAdmin){ isAdmin = true; showAdminMain(); }
  }catch(e){}
}
async function tryAdminLogin(){
  const val = document.getElementById('adminPass').value;
  try{
    await api('POST', '/api/admin/login', {password: val});
    isAdmin = true;
    showAdminMain();
  }catch(e){
    document.getElementById('adminLoginMsg').textContent = e.message || 'Nesprávne heslo.';
  }
}
async function adminLogout(){
  await api('POST', '/api/admin/logout');
  isAdmin = false;
  document.getElementById('adminLoginView').style.display='block';
  document.getElementById('adminMainView').style.display='none';
  document.getElementById('adminPass').value = '';
}
function showAdminMain(){
  document.getElementById('adminLoginView').style.display='none';
  document.getElementById('adminMainView').style.display='block';
  populateAdminForms();
}
function showAdminTab(tab){
  document.querySelectorAll('.atab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.admin-panel-view').forEach(v=>v.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
}
async function populateAdminForms(){
  document.getElementById('adm_heroTitle').value = SITE.heroTitle;
  document.getElementById('adm_heroTagline').value = SITE.heroTagline;
  document.getElementById('adm_aboutText').value = SITE.aboutText;
  document.getElementById('adm_basePrice').value = SITE.basePrice;
  try{ ADMIN_BLOCKS = await api('GET','/api/admin/blocks'); }catch(e){ ADMIN_BLOCKS = []; }
  try{ ADMIN_NEWSLETTER = await api('GET','/api/admin/newsletter'); }catch(e){ ADMIN_NEWSLETTER = []; }
  renderRequestsAdmin(); renderBlocksAdmin(); renderPricingAdmin(); renderGalleryAdmin(); renderDealsAdmin(); renderNewsletterAdmin();
}
async function saveContent(){
  try{
    const res = await api('PUT', '/api/admin/content', {
      heroTitle: document.getElementById('adm_heroTitle').value,
      heroTagline: document.getElementById('adm_heroTagline').value,
      aboutText: document.getElementById('adm_aboutText').value,
      basePrice: parseFloat(document.getElementById('adm_basePrice').value)
    });
    SITE = res.site;
    document.getElementById('contentSaveMsg').textContent = 'Uložené.';
    renderAll();
  }catch(e){ document.getElementById('contentSaveMsg').textContent = e.message || 'Chyba pri ukladaní.'; }
}

/* -- requests / blocking -- */
function renderRequestsAdmin(){
  const list = document.getElementById('requestsAdminList');
  list.innerHTML = '';
  const requests = ADMIN_BLOCKS.filter(b=>b.ref);
  if(!requests.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne žiadosti.</div>'; return; }
  [...requests].reverse().forEach(b=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    const pill = `<span class="status-pill ${b.status}">${b.status==='confirmed' ? 'Potvrdené' : 'Čaká'}</span>`;
    row.innerHTML = `<span><span class="ref-code">${b.ref}</span> — ${fmtShort(b.start)} → ${fmtShort(b.end)} · ${b.guests} hostí ${pill}</span>`;
    const btns = document.createElement('div'); btns.className = 'btns';
    if(b.status === 'pending'){
      const okBtn = document.createElement('button'); okBtn.className='small-btn good'; okBtn.textContent='Potvrdiť';
      okBtn.onclick = async ()=>{ await api('PATCH', `/api/admin/blocks/${b.id}`, {status:'confirmed'}); await populateAdminForms(); await refreshPublicState(); };
      btns.appendChild(okBtn);
    }
    const cancelBtn = document.createElement('button'); cancelBtn.className='small-btn danger'; cancelBtn.textContent='Zrušiť';
    cancelBtn.onclick = async ()=>{ await api('DELETE', `/api/admin/blocks/${b.id}`); await populateAdminForms(); await refreshPublicState(); };
    btns.appendChild(cancelBtn);
    row.appendChild(btns);
    list.appendChild(row);
  });
}
function renderBlocksAdmin(){
  const list = document.getElementById('blocksAdminList');
  list.innerHTML = '';
  const manual = ADMIN_BLOCKS.filter(b=>!b.ref);
  if(!manual.length){ list.innerHTML = '<div class="admin-empty">Žiadne ručné blokovania.</div>'; return; }
  manual.forEach(b=>{
    const row = document.createElement('div'); row.className='admin-row';
    row.innerHTML = `<span>${fmtShort(b.start)} → ${fmtShort(b.end)} <span class="meta">— ${b.note||''}</span></span>`;
    const btn = document.createElement('button'); btn.className='small-btn danger'; btn.textContent='Uvoľniť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/blocks/${b.id}`); await populateAdminForms(); await refreshPublicState(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addManualBlock(){
  const start = document.getElementById('adm_blockStart').value;
  const end = document.getElementById('adm_blockEnd').value;
  const note = document.getElementById('adm_blockNote').value.trim();
  if(!start || !end || end<=start) return;
  try{
    await api('POST', '/api/admin/blocks', {start, end, note});
    document.getElementById('adm_blockStart').value=''; document.getElementById('adm_blockEnd').value=''; document.getElementById('adm_blockNote').value='';
    await populateAdminForms(); await refreshPublicState();
  }catch(e){ alert(e.message); }
}

/* -- pricing -- */
function renderPricingAdmin(){
  const list = document.getElementById('pricingAdminList'); list.innerHTML = '';
  if(!PRICE_RULES.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne cenové pravidlá — platí základná cena.</div>'; return; }
  PRICE_RULES.forEach(r=>{
    const row = document.createElement('div'); row.className='admin-row';
    row.innerHTML = `<span>${r.label || '(bez popisu)'} <span class="meta">— ${fmtShort(r.start)} → ${fmtShort(r.end)}, ${r.price} €/noc</span></span>`;
    const btn = document.createElement('button'); btn.className='small-btn danger'; btn.textContent='Odstrániť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/pricing/${r.id}`); await refreshPublicState(); renderPricingAdmin(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addPriceRule(){
  const start = document.getElementById('adm_priceStart').value;
  const end = document.getElementById('adm_priceEnd').value;
  const price = parseFloat(document.getElementById('adm_priceValue').value);
  const label = document.getElementById('adm_priceLabel').value.trim();
  if(!start || !end || end<=start || !price) return;
  try{
    await api('POST', '/api/admin/pricing', {start, end, price, label});
    ['adm_priceStart','adm_priceEnd','adm_priceValue','adm_priceLabel'].forEach(i=>document.getElementById(i).value='');
    await refreshPublicState(); renderPricingAdmin();
  }catch(e){ alert(e.message); }
}

/* -- gallery -- */
const GALLERY_WARN_BYTES = 6_000_000; // rough heads-up threshold for total uploaded-photo disk usage shown to admin

function renderGalleryAdmin(){
  const list = document.getElementById('galleryAdminList'); list.innerHTML = '';
  const note = document.getElementById('galleryStorageNote');
  if(note) note.textContent = `${GALLERY.length} fotiek v galérii. Fotky sa ukladajú ako súbory na serveri (priečinok public/images/uploads), takže tu nie je prakticky žiadny limit ako predtým v prehliadači.`;
  if(!GALLERY.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne fotky.</div>'; return; }
  GALLERY.forEach(g=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    const thumbWrap = document.createElement('div'); thumbWrap.className = 'gallery-thumb-row';
    const thumb = document.createElement('div'); thumb.className = 'thumb';
    thumb.style.background = g.url ? `url('${g.url}') center/cover` : (g.tone || '#5B6F5C');
    const capInput = document.createElement('input');
    capInput.value = g.caption || ''; capInput.placeholder = 'Popis fotky';
    capInput.style.cssText = 'border:1px solid var(--line); border-radius:4px; padding:6px 8px; font-family:inherit; font-size:0.85rem;';
    capInput.onchange = async ()=>{ await api('PATCH', `/api/admin/gallery/${g.id}`, {caption: capInput.value.trim()}); refreshPublicState(); };
    thumbWrap.appendChild(thumb); thumbWrap.appendChild(capInput);
    row.appendChild(thumbWrap);
    const btn = document.createElement('button'); btn.className = 'small-btn danger'; btn.textContent='Odstrániť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/gallery/${g.id}`); await refreshPublicState(); renderGalleryAdmin(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addGalleryImage(){
  const url = document.getElementById('adm_imgUrl').value.trim();
  const caption = document.getElementById('adm_imgCap').value.trim();
  if(!url) return;
  try{
    await api('POST', '/api/admin/gallery', {url, caption});
    document.getElementById('adm_imgUrl').value=''; document.getElementById('adm_imgCap').value='';
    await refreshPublicState(); renderGalleryAdmin();
  }catch(e){ alert(e.message); }
}

/* -- device photo upload: compress in the browser, then upload the real file to the server -- */
function compressImageFile(file, maxDim = 1600, quality = 0.85){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error('read failed'));
    reader.onload = ()=>{
      const img = new Image();
      img.onerror = ()=>reject(new Error('decode failed'));
      img.onload = ()=>{
        let {width, height} = img;
        if(width > maxDim || height > maxDim){
          if(width >= height){ height = Math.round(height * (maxDim/width)); width = maxDim; }
          else { width = Math.round(width * (maxDim/height)); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
async function handleFileUpload(fileList){
  const files = Array.from(fileList || []).filter(f=>f.type.startsWith('image/'));
  if(!files.length) return;
  const progress = document.getElementById('uploadProgress');
  for(let i=0; i<files.length; i++){
    progress.textContent = `Nahrávam fotku ${i+1} z ${files.length}...`;
    try{
      const blob = await compressImageFile(files[i]);
      const form = new FormData();
      form.append('photo', blob, files[i].name.replace(/\.[a-zA-Z0-9]+$/, '') + '.jpg');
      form.append('caption', files[i].name.replace(/\.[a-zA-Z0-9]+$/, ''));
      await api('POST', '/api/admin/gallery/upload', form, true);
    }catch(e){
      progress.textContent = `Fotku ${files[i].name} sa nepodarilo nahrať: ${e.message}`;
      break;
    }
  }
  if(!progress.textContent.includes('nepodarilo')){
    progress.textContent = `Hotovo — nahraných ${files.length} ${files.length===1?'fotka':'fotky'}.`;
  }
  document.getElementById('adm_imgFile').value = '';
  await refreshPublicState(); renderGalleryAdmin();
}
document.addEventListener('DOMContentLoaded', ()=>{
  const zone = document.getElementById('uploadDropzone');
  if(!zone) return;
  ['dragover','dragenter'].forEach(evt=>zone.addEventListener(evt, e=>{ e.preventDefault(); zone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(evt=>zone.addEventListener(evt, e=>{ e.preventDefault(); zone.classList.remove('drag'); }));
  zone.addEventListener('drop', e=>{ if(e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files); });
  zone.addEventListener('click', (e)=>{ if(e.target === zone) document.getElementById('adm_imgFile').click(); });
});

/* -- deals -- */
function renderDealsAdmin(){
  const list = document.getElementById('dealsAdminList'); list.innerHTML = '';
  if(!DEALS.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadne last-minute ponuky.</div>'; return; }
  DEALS.forEach(d=>{
    const row = document.createElement('div'); row.className = 'admin-row';
    row.innerHTML = `<span>${d.title} <span class="meta">— ${fmtShort(d.start)} → ${fmtShort(d.end)}, -${d.discount}%</span></span>`;
    const btn = document.createElement('button'); btn.className='small-btn danger'; btn.textContent='Odstrániť';
    btn.onclick = async ()=>{ await api('DELETE', `/api/admin/deals/${d.id}`); await refreshPublicState(); renderDealsAdmin(); renderPricingAdmin(); };
    row.appendChild(btn); list.appendChild(row);
  });
}
async function addDeal(){
  const title = document.getElementById('adm_dealTitle').value.trim();
  const start = document.getElementById('adm_dealStart').value;
  const end = document.getElementById('adm_dealEnd').value;
  const discount = parseFloat(document.getElementById('adm_dealDiscount').value) || 0;
  const note = document.getElementById('adm_dealNote').value.trim();
  if(!title || !start || !end || end<=start) return;
  try{
    await api('POST', '/api/admin/deals', {title, start, end, discount, note});
    ['adm_dealTitle','adm_dealStart','adm_dealEnd','adm_dealDiscount','adm_dealNote'].forEach(i=>document.getElementById(i).value='');
    await refreshPublicState(); renderDealsAdmin(); renderPricingAdmin();
  }catch(e){ alert(e.message); }
}

/* -- newsletter (admin view) -- */
function renderNewsletterAdmin(){
  const list = document.getElementById('newsletterAdminList'); list.innerHTML = '';
  if(!ADMIN_NEWSLETTER.length){ list.innerHTML = '<div class="admin-empty">Zatiaľ žiadni odberatelia.</div>'; return; }
  [...ADMIN_NEWSLETTER].reverse().forEach(email=>{ const row = document.createElement('div'); row.className = 'admin-row'; row.innerHTML = `<span>${email}</span>`; list.appendChild(row); });
}

/* ---------- boot ---------- */
(async function init(){
  const t = new Date(); calYear = t.getFullYear(); calMonth = t.getMonth();
  await loadState();
  checkAdminSession();
  const p = location.hash.replace('#','') || 'home';
  navigate(['home','calendar','gallery','nearby','contact'].includes(p) ? p : 'home');
})();
