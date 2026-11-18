'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const B = window.Bersama;
const HARI = B.HARI;
const island = $('#island');

let cfg = null;
let mode = 'compact';           // compact | expanded | alert
let media = { ada: false };
let battery = null;
let bkSt = null;                // status BukuKelas
let internet = { online: true, sejak: Date.now() };
let kontrolSt = null;
let geser = null;               // keadaan saat menyeret pil
let kalBulan = null, kalPilih = null;
const acakSudah = [];
const timer = { total: 0, left: 0, endAt: 0, running: false };
const fired = new Set();
const alertQ = [];
let alertCur = null, alertT = null, alertLeft = 0;
let mouseIn = false, hoverT = null, leaveT = null;

// ---------- Utilitas ----------
const pad = n => String(n).padStart(2, '0');
const toMin = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
const fmtMin = m => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.round(m % 60))}`;
const fmtSec = s => s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nowMin = d => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

function jamTeks(d, detik = false) {
  let h = d.getHours();
  let suf = '';
  if (cfg.tampilan.formatJam === '12') { suf = h < 12 ? ' AM' : ' PM'; h = h % 12 || 12; }
  return `${pad(h)}:${pad(d.getMinutes())}${detik ? `<small>:${pad(d.getSeconds())}</small>` : ''}${suf}`;
}

const bkData = () => (bkSt && bkSt.masuk && bkSt.data) || null;
function infoHariIni(d) { return B.infoHari(B.tglStr(d), bkData() ? bkData().presensi : null); }
function jadwalHari(d) {
  if (!infoHariIni(d).sekolah) return [];
  return B.jadwalHari(cfg, d);
}
function mapelBK(nama) {
  const d = bkData();
  return d ? B.cocokMapel(nama, d.struktur, (cfg.bukukelas || {}).mapelJadwal) : null;
}
function statusPelajaran(d) {
  const list = jadwalHari(d), n = nowMin(d);
  return { list, kini: list.find(x => n >= x.s && n < x.e), next: list.find(x => x.s > n) };
}

// ---------- Tema ----------
let aksenAktif = null;
function applyTheme(aksenGanti = aksenAktif) {
  const t = cfg.tampilan, r = document.documentElement.style;
  const tema = t.tema && t.tema !== 'kustom' ? (B.TEMA.find(x => x.id === t.tema) || {}) : {};
  const v = B.varTema({ ...t, latarCss: tema.latarCss || '' }, aksenGanti);
  for (const [k, val] of Object.entries(v)) r.setProperty(k, val);
  r.setProperty('--lebar', `${Number(t.lebarRingkas) || 230}px`);
  r.setProperty('--op', (Number(t.transparansi) || 100) / 100);
}
// Aksen mengikuti warna mapel yang sedang berlangsung (warna sama dengan BukuKelas).
function aksenMapel(kini) {
  if (!cfg.tampilan.aksenMapel || !kini || !kini.pelajaran) return null;
  const m = mapelBK(kini.mapel);
  if (m) return B.PALET_MAPEL[(m.warna || 0) % B.PALET_MAPEL.length];
  let h = 0; for (const c of kini.mapel) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return B.PALET_MAPEL[h % B.PALET_MAPEL.length];
}

// ---------- Karakter (kucing) ----------
// Gambar kucing di pil berkedip sendiri setiap 3–7 detik (kadang dua kali).
function renderKarakter() {
  const t = cfg.tampilan, id = window.karakterId(t.karakter);
  const ada = id !== 'none' && t.karakterTampil !== false;
  document.body.classList.toggle('ada-av', ada);
  document.body.classList.toggle('av-gerak', t.karakterGerak !== false);
  if (!ada) return;
  const html = window.KARAKTER.kucing.html;
  if (!$('#c-av img')) $('#c-av').innerHTML = html;
  if (!$('#a-av img')) $('#a-av').innerHTML = html;
  $('#a-av').classList.add('senang');
}
let tKedipPil = null;
function kedipPil() {
  clearTimeout(tKedipPil);
  const urut = ['kedip_2', 'kedip_3', 'kedip_2', 'kedip_1'], ganda = Math.random() < .25;
  const seq = ganda ? [...urut, ...urut] : urut;
  seq.forEach((n, i) => setTimeout(() => document.querySelectorAll('#c-av img, #a-av img').forEach(im => { im.src = window.srcKucing(n); }), i * 70));
  tKedipPil = setTimeout(kedipPil, 3000 + Math.random() * 4000);
}
['kedip_2', 'kedip_3'].forEach(n => { const im = new Image(); im.src = window.srcKucing(n); });   // muat lebih dulu
setTimeout(kedipPil, 3000);

// ---------- Isi & lebar pil kecil ----------
function pilKecil() {
  const d = { karakter: true, jam: true, detik: false, sisa: true, baterai: true, cuaca: false, lebarOtomatis: true,
    info: { timer: true, pelajaran: true, sholat: true, musik: true, berikutnya: true, tanggal: true } };
  const p = (cfg.tampilan || {}).pilKecil || {};
  return { ...d, ...p, info: { ...d.info, ...(p.info || {}) } };
}
let lebarTerakhir = 0;
function aturLebarPil(pk) {
  if (!pk.lebarOtomatis) {
    if (lebarTerakhir) { lebarTerakhir = 0; document.documentElement.style.setProperty('--lebar', `${Number(cfg.tampilan.lebarRingkas) || 230}px`); }
    return;
  }
  const el = $('#compact');
  const anak = [...el.children].filter(c => c.id !== 'c-bar' && getComputedStyle(c).display !== 'none');
  // lebar asli teks (bukan lebar kotak yang sedang melebar) diukur dengan Range
  const lebarTeks = c => { const r = document.createRange(); r.selectNodeContents(c); return r.getBoundingClientRect().width; };
  const isi = anak.reduce((a, c) => a + (c.id === 'c-ctx' ? Math.min(lebarTeks(c), 240) : (c.classList.contains('av') ? 22 : lebarTeks(c))), 0);
  const gap = Math.max(0, anak.length - 1) * 10;
  const w = Math.round(Math.min(470, Math.max(96, isi + gap + 34)));
  if (Math.abs(w - lebarTerakhir) > 3) { lebarTerakhir = w; document.documentElement.style.setProperty('--lebar', w + 'px'); }
}

// ---------- Mode & mouse ----------
function setMode(m) {
  mode = m;
  island.className = m;
  render(new Date());
}
island.addEventListener('mouseenter', () => {
  mouseIn = true;
  window.api.setIgnore(false);
  clearTimeout(leaveT);
  if (mode === 'compact' && cfg.tampilan.modeBuka === 'hover' && !geser) {
    hoverT = setTimeout(() => mouseIn && mode === 'compact' && setMode('expanded'), 150);
  }
});
island.addEventListener('mouseleave', () => {
  if (geser) return;
  mouseIn = false;
  clearTimeout(hoverT);
  window.api.setIgnore(true);
  if (mode === 'expanded') {
    leaveT = setTimeout(() => {
      if (!mouseIn && document.activeElement !== $('#t-custom')) setMode('compact');
    }, cfg.tampilan.modeBuka === 'hover' ? 450 : 900);
  }
});
$('#compact').addEventListener('click', () => { if (Date.now() - geserSelesai < 300) return; setMode('expanded'); });

// ---------- Menggeser pil ----------
let geserSelesai = 0;
function mulaiGeser(e) {
  if (e.button !== 0) return;
  const el = e.currentTarget;
  window.api.posisi().then(p => {
    if (!geser || !Array.isArray(p)) return;
    geser.wx = Number(p[0]); geser.wy = Number(p[1]);
  }).catch(() => {});
  geser = { el, id: e.pointerId, sx: e.screenX, sy: e.screenY, wx: null, wy: null, aktif: false };
  el.setPointerCapture(e.pointerId);
  clearTimeout(hoverT);
}
function gerakGeser(e) {
  if (!geser || e.pointerId !== geser.id || !Number.isFinite(geser.wx) || !Number.isFinite(geser.wy)) return;
  if (!Number.isFinite(e.screenX) || !Number.isFinite(e.screenY)) return;
  const dx = e.screenX - geser.sx, dy = e.screenY - geser.sy;
  if (!geser.aktif && Math.hypot(dx, dy) < 5) return;
  geser.aktif = true;
  document.body.classList.add('geser');
  window.api.geser(geser.wx + dx, geser.wy + dy);
}
function akhirGeser(e) {
  if (!geser || e.pointerId !== geser.id) return;
  const g = geser; geser = null;
  try { g.el.releasePointerCapture(e.pointerId); } catch { /* sudah lepas */ }
  document.body.classList.remove('geser');
  if (!g.aktif) return;
  geserSelesai = Date.now();
  const r = island.getBoundingClientRect();
  window.api.lepas({ x: r.left, y: r.top, w: r.width, h: r.height });
}
for (const el of [$('#compact'), $('#grip')]) el.addEventListener('pointerdown', mulaiGeser);
// Gerak & lepas didengar di seluruh jendela agar tetap tertangkap walau kursor lebih cepat dari pil.
window.addEventListener('pointermove', gerakGeser);
window.addEventListener('pointerup', akhirGeser);
window.addEventListener('pointercancel', akhirGeser);
window.addEventListener('lostpointercapture', e => { if (geser && geser.aktif) akhirGeser(e); });
window.addEventListener('blur', () => { if (geser) akhirGeser({ pointerId: geser.id }); });
window.api.onAnchor(a => {
  document.body.classList.toggle('v-bawah', a.v === 'bawah');
  document.body.classList.toggle('h-kiri', a.h === 'kiri');
  document.body.classList.toggle('h-kanan', a.h === 'kanan');
});
$('#t-custom').addEventListener('blur', () => { if (!mouseIn && mode === 'expanded') setMode('compact'); });

$$('#tabs button[data-tab]').forEach(b => b.addEventListener('click', () => bukaTab(b.dataset.tab)));
function bukaTab(name) {
  if (name === 'musik') window.api.kontrol('get');
  $$('#tabs button[data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === name));
  $$('section').forEach(x => x.classList.toggle('on', x.dataset.tab === name));
  render(new Date());
}
$('#btn-set').addEventListener('click', () => window.api.openSettings());

// ---------- Peringatan ----------
function bunyi() {
  if (!cfg.pengingat.suara) return;
  try {
    const ac = new AudioContext();
    [0, 0.22, 0.44].forEach((t, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = [880, 1046, 1318][i];
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.2);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.22);
    });
    setTimeout(() => ac.close(), 1200);
  } catch { /* tanpa suara */ }
}
function pushAlert(title, body, aksi = null) {
  alertQ.push({ title, body, aksi });
  if (cfg.pengingat.notifWindows) window.api.notify(title, body);
  if (!alertCur) nextAlert();
}
function nextAlert() {
  clearInterval(alertT);
  alertCur = alertQ.shift() || null;
  if (!alertCur) { setMode(mouseIn ? 'expanded' : 'compact'); return; }
  $('#a-title').textContent = alertCur.title;
  $('#a-body').textContent = alertCur.body;
  const act = $('#a-act');
  act.hidden = !alertCur.aksi;
  if (alertCur.aksi) act.textContent = alertCur.aksi.label;
  $('#a-close').textContent = alertCur.aksi ? 'Nanti' : 'Tutup';
  $('#a-close').classList.toggle('sek', !!alertCur.aksi);
  alertLeft = (Number(cfg.pengingat.lamaTampil) || 20) * (alertCur.aksi ? 3 : 1);
  $('#a-count').textContent = `tutup otomatis ${alertLeft} dtk`;
  setMode('alert');
  bunyi();
  alertT = setInterval(() => {
    alertLeft--;
    $('#a-count').textContent = `tutup otomatis ${alertLeft} dtk`;
    if (alertLeft <= 0 && !mouseIn) nextAlert();
  }, 1000);
}
$('#a-close').addEventListener('click', nextAlert);
$('#a-act').addEventListener('click', () => { const a = alertCur && alertCur.aksi; nextAlert(); if (a) a.fn(); });

function sholatHari(d) {
  const c = cfg.sholat || {};
  if (c.aktif === false) return [];
  const w = B.waktuSholat(d, Number(c.lat) || -0.48, Number(c.lon) || 102.44, 7);
  return B.NAMA_SHOLAT.map(([k, n]) => ({ k, nama: d.getDay() === 5 && k === 'dzuhur' ? 'Dzuhur/Jumat' : n, m: w[k] }));
}
function cekPengingat(d) {
  const day = d.toDateString(), n = nowMin(d), p = cfg.pengingat;
  const fire = (id, at, title, body, aksi) => {
    const k = `${day}|${id}|${at}`;
    if (fired.has(k)) return;
    if (n >= at && n < at + 1) { fired.add(k); pushAlert(title, body, aksi); }
  };
  const list = jadwalHari(d);
  list.forEach((x, i) => {
    const info = `${x.mapel}${x.ket ? ' · ' + x.ket : ''}  (${x.jp} JP, ${fmtMin(x.s)}–${fmtMin(x.e)})` + catatanHujan(x);
    if (Number(p.menitSebelum) > 0) fire(`pre${i}`, x.s - Number(p.menitSebelum), `${p.menitSebelum} menit lagi`, info);
    if (p.saatMulai) fire(`mulai${i}`, x.s, 'Pelajaran dimulai', info);
    const adaLanjut = list.some(y => y.s === x.e);
    const mb = x.pelajaran && p.tawarJurnal !== false ? mapelBK(x.mapel) : null;
    if (mb) {
      fire(`jurnal${i}`, x.e, 'Pelajaran selesai · isi jurnal?', `${mb.nama} · jam ke-${x.jpKe} (${fmtMin(x.s)}–${fmtMin(x.e)})`,
        { label: 'Isi jurnal', fn: () => window.api.openKelas({ tab: 'jurnal', mapel: mb.id, jp: x.jpKe, tgl: B.tglStr(new Date()) }) });
    } else if (p.saatSelesai && !(adaLanjut && p.saatMulai)) {
      fire(`selesai${i}`, x.e, 'Pelajaran selesai', `${x.mapel} berakhir pukul ${fmtMin(x.e)}`);
    }
  });
  // Pengingat minum air
  const mi = (cfg.pengingat || {}).minum || {};
  if (mi.aktif !== false && Number(mi.interval) > 0 && (!mi.hanyaSekolah || infoHariIni(d).sekolah)) {
    const a = toMin(mi.mulai || '07:00'), z = toMin(mi.selesai || '14:00'), iv = Number(mi.interval);
    for (let m = a + iv; m <= z; m += iv) fire(`minum${m}`, m, 'Waktunya minum air 💧', 'Minum segelas air dulu supaya suara tetap segar dan badan tidak lelah.');
  }
  const cs = cfg.sholat || {};
  sholatHari(d).forEach(x => {
    if (Number(cs.menitSebelum) > 0) fire(`sh-pre-${x.k}`, x.m - Number(cs.menitSebelum), `${cs.menitSebelum} menit lagi`, `Waktu sholat ${x.nama} pukul ${fmtMin(x.m)}`);
    if (cs.saatAdzan) fire(`sh-${x.k}`, x.m, 'Waktu sholat', `${x.nama} · ${fmtMin(x.m)}`);
  });
  (cfg.pengingatKhusus || []).forEach((r, i) => {
    if (!r.jam || !r.teks) return;
    if (Array.isArray(r.hari) && r.hari.length && !r.hari.includes(d.getDay())) return;
    fire(`k${i}`, toMin(r.jam), 'Pengingat', r.teks);
  });
  // Tugas dari kartu widget: sekali sehari mulai 07.00 (atau saat laptop baru dinyalakan setelahnya)
  const kTugas = `${day}|tugas`;
  if (n >= 7 * 60 && !fired.has(kTugas) && Array.isArray(cfg.tugas)) {
    fired.add(kTugas);
    const hari = B.tglStr(d);
    const jatuh = cfg.tugas.filter(t => !t.selesai && t.tenggat && t.tenggat <= hari);
    if (jatuh.length) {
      const lewat = jatuh.filter(t => t.tenggat < hari).length;
      pushAlert(`Tugas ${lewat ? 'jatuh tempo' : 'hari ini'} (${jatuh.length})`,
        jatuh.slice(0, 3).map(t => (t.tenggat < hari ? '⚠ ' : '• ') + t.teks).join('  ') + (jatuh.length > 3 ? `  +${jatuh.length - 3} lagi` : ''));
    }
  }
}

// ---------- Timer ----------
function timerStart(min) {
  if (min) { timer.total = Math.round(min * 60); timer.left = timer.total; }
  if (timer.left <= 0) return;
  timer.endAt = Date.now() + timer.left * 1000;
  timer.running = true;
  render(new Date());
}
function timerPause() {
  if (!timer.running) return;
  timer.left = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
  timer.running = false;
  render(new Date());
}
function timerReset() { timer.running = false; timer.left = 0; timer.total = 0; render(new Date()); }
function timerTick() {
  if (!timer.running) return;
  timer.left = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
  if (timer.left === 0) {
    const menit = Math.round(timer.total / 60);
    timer.running = false; timer.total = 0;
    pushAlert('Waktu habis!', `Timer ${menit} menit telah selesai.`);
  }
}
$('#t-start').addEventListener('click', () => {
  const v = Number($('#t-custom').value);
  if (v > 0) { timerStart(v); $('#t-custom').value = ''; $('#t-custom').blur(); }
  else timerStart();
});
$('#t-custom').addEventListener('keydown', e => { if (e.key === 'Enter') $('#t-start').click(); });
$('#t-pause').addEventListener('click', timerPause);
$('#t-reset').addEventListener('click', timerReset);

function renderPresets() {
  $('#t-presets').innerHTML = (cfg.timerPreset || []).map(m => `<button data-min="${Number(m)}">${Number(m)} mnt</button>`).join('');
  $$('#t-presets button').forEach(b => b.addEventListener('click', () => timerStart(Number(b.dataset.min))));
}

// ---------- Musik ----------
function namaApp(id) {
  if (!id) return '';
  const s = id.toLowerCase();
  const kenal = { spotify: 'Spotify', chrome: 'Chrome', msedge: 'Edge', firefox: 'Firefox', zunemusic: 'Media Player', vlc: 'VLC', opera: 'Opera', brave: 'Brave', youtube: 'YouTube' };
  for (const k in kenal) if (s.includes(k)) return kenal[k];
  return id.replace(/\.exe$/i, '').split(/[!\\.]/).pop();
}
window.api.onMedia(m => { media = m || { ada: false }; render(new Date()); });
$$('#m-ctrl button').forEach(b => b.addEventListener('click', () => {
  window.api.media(b.dataset.m);
  if (b.dataset.m === 'playpause' && media.ada) {
    media.status = media.status === 'Playing' ? 'Paused' : 'Playing';
    render(new Date());
  }
}));

// ---------- Pintasan ----------
function renderPintasan() {
  const list = cfg.pintasan || [];
  $('#p-grid').innerHTML = list.length
    ? list.map((p, i) => `<button data-i="${i}" title="${esc(p.target)}"><span class="ini">${esc((p.nama || '?').trim().charAt(0).toUpperCase())}</span>${esc(p.nama)}</button>`).join('')
    : '<p class="muted">Belum ada pintasan. Tambahkan lewat Pengaturan.</p>';
  $$('#p-grid button').forEach(b => b.addEventListener('click', () => window.api.open(list[b.dataset.i].target)));
  // ganti huruf depan dengan logo asli begitu tersedia
  list.forEach((p, i) => window.api.ikonPintasan(p.target).then(src => {
    const el = $(`#p-grid button[data-i="${i}"] .ini`);
    if (src && el) { el.classList.add('logo'); el.innerHTML = `<img src="${src}" alt="" draggable="false">`; }
  }).catch(() => {}));
}

// ---------- Baterai ----------
if (navigator.getBattery) {
  navigator.getBattery().then(b => {
    battery = b;
    ['levelchange', 'chargingchange'].forEach(ev => b.addEventListener(ev, () => { cekBaterai(); render(new Date()); }));
    setTimeout(cekBaterai, 4000);
  }).catch(() => {});
}
function batLemah() {
  if (!cfg) return false;
  const b = (cfg.pengingat || {}).baterai || {};
  return battery && b.aktif !== false && !battery.charging && Math.round(battery.level * 100) <= (Number(b.batas) || 20);
}
function batTeks(pendek) {
  if (!battery) return '';
  const lv = Math.round(battery.level * 100);
  const cas = battery.charging ? '⚡' : '';
  if (pendek) return batLemah() ? `<span class="bat-low">🪫${lv}%</span>` : `${cas}${lv}%`;
  return `${cas}${lv}%<span class="batt ${lv <= 20 && !battery.charging ? 'low' : ''}"><i style="width:${lv}%"></i></span>`;
}

// ---------- Render ----------
function render(d) {
  if (!cfg) return;
  const st = statusPelajaran(d), n = nowMin(d);
  const timerAktif = timer.running || timer.left > 0;
  const bar = $('#c-bar');
  const ak = aksenMapel(st.kini);
  if (ak !== aksenAktif) { aksenAktif = ak; applyTheme(ak); }

  // Ringkas: isi mengikuti pilihan di Pengaturan -> Tampilan -> Isi pil kecil
  const pk = pilKecil();
  $('#c-time').innerHTML = pk.jam ? jamTeks(d, pk.detik) : '';
  $('#c-time').style.display = pk.jam ? '' : 'none';
  let ctx = '', sisa = '', prog = null;
  const info = pk.info;
  const sh = sholatDekat(d, n);
  if (info.timer && timerAktif) {
    ctx = `⏱ ${fmtSec(timer.left)}${timer.running ? '' : ' (jeda)'}`;
    prog = timer.total ? (1 - timer.left / timer.total) : null;
  } else if (info.pelajaran && st.kini) {
    ctx = st.kini.mapel;
    sisa = `${Math.ceil(st.kini.e - n)} mnt`;
    prog = (n - st.kini.s) / (st.kini.e - st.kini.s);
  } else if (info.sholat && sh) {
    ctx = `${sh.nama.split('/')[0]} ${fmtMin(sh.m)}`;
    sisa = `${Math.ceil(sh.m - n)} mnt`;
  } else if (info.musik && media.ada && media.status === 'Playing') {
    ctx = `♪ ${media.judul}${media.artis ? ' — ' + media.artis : ''}`;
  } else if (info.berikutnya && st.next) {
    ctx = `${st.next.mapel} ${fmtMin(st.next.s)}`;
  } else if (info.tanggal) {
    ctx = `${HARI[d.getDay()]}, ${d.getDate()} ${d.toLocaleDateString('id-ID', { month: 'short' })}`;
  }
  $('#c-ctx').textContent = ctx;
  $('#c-ctx').style.display = ctx ? '' : 'none';
  const bag = [];
  if (pk.sisa && sisa) bag.push(sisa);
  if (pk.cuaca && cuaca && (cfg.cuaca || {}).aktif !== false) bag.push(`${B.cuacaKode(cuaca.kode, cuaca.siang)[0]}${Math.round(cuaca.suhu)}°`);
  if (!internet.online) bag.push('<span class="off" title="Internet terputus">⚠ offline</span>');
  if (batLemah()) bag.push(batTeks(true));
  else if (pk.baterai && battery) bag.push(batTeks(true));
  $('#c-ind').innerHTML = bag.join(' · ');
  $('#c-ind').style.display = bag.length ? '' : 'none';
  document.body.classList.toggle('tanpa-av-pil', !pk.karakter);
  aturLebarPil(pk);
  island.classList.toggle('lemah', batLemah() && mode !== 'alert');
  bar.classList.toggle('on', prog !== null);
  if (prog !== null) bar.firstElementChild.style.width = `${Math.min(100, Math.max(0, prog * 100))}%`;

  if (mode !== 'expanded') return;
  const tab = $('#tabs button.on')?.dataset.tab;

  if (tab === 'beranda') renderBeranda(d, st, n);

  if (tab === 'jadwal') {
    const total = st.list.reduce((a, x) => a + (/istirahat|upacara/i.test(x.mapel) ? 0 : x.jp), 0);
    $('#j-head').textContent = `${HARI[d.getDay()]} · ${st.list.length} kegiatan · ${total} JP pelajaran · 1 JP = ${cfg.menitPerJP} menit`;
    $('#j-list').innerHTML = st.list.length
      ? st.list.map(x => `<li class="${n >= x.e ? 'lewat' : (n >= x.s ? 'kini' : '')}">
          <span class="jam">${fmtMin(x.s)}–${fmtMin(x.e)}</span>
          <span class="mp">${esc(x.mapel)}${x.ket ? ` <span class="muted">· ${esc(x.ket)}</span>` : ''}</span>
          <span class="muted">${x.jp} JP</span></li>`).join('')
      : `<li class="muted">${!infoHariIni(d).sekolah ? 'Libur: ' + esc(infoHariIni(d).alasan) + '.' : 'Belum ada jadwal untuk hari ini.'}</li>`;
  }

  if (tab === 'kelas') renderKelas();
  if (tab === 'kalender') renderKalender(d);

  if (tab === 'musik') {
    if (media.ada && (media.judul || media.artis)) {
      $('#m-app').textContent = `${namaApp(media.app)} · ${media.status === 'Playing' ? 'Diputar' : 'Dijeda'}`;
      $('#m-title').textContent = media.judul || '(tanpa judul)';
      $('#m-artist').textContent = media.artis || '';
    } else {
      $('#m-app').textContent = media.galat || 'Tidak ada media';
      $('#m-title').textContent = 'Putar musik atau video';
      $('#m-artist').textContent = 'Spotify, YouTube di browser, Media Player, dll.';
    }
    $('#m-pp').textContent = media.status === 'Playing' ? '⏸' : '▶';
    renderKontrol();
  }

  if (tab === 'timer') {
    $('#t-display').textContent = fmtSec(timer.left);
    $('#t-bar').firstElementChild.style.width = `${timer.total ? (1 - timer.left / timer.total) * 100 : 0}%`;
    $('#t-pause').disabled = !timer.running;
  }
}

function sholatDekat(d, n) {
  const x = sholatHari(d).find(y => y.m > n);
  return x && x.m - n <= 20 ? x : null;
}

// ---------- Beranda: tata letak & kotak yang bisa diatur ----------
const BLOK_BAWAAN = ['jam', 'pelajaran', 'sholat', 'cuaca', 'baterai', 'kehadiran'];
function aturBeranda() {
  const b = (cfg.tampilan || {}).beranda || {};
  let blok = Array.isArray(b.blok) ? b.blok.filter(x => BLOK_BAWAAN.includes(x.id)) : [];
  for (const id of BLOK_BAWAAN) if (!blok.some(x => x.id === id)) blok.push({ id, on: id !== 'kehadiran' });
  return { tata: b.tata || 'kotak', blok: blok.filter(x => x.on).map(x => x.id) };
}
function htmlKarakter() { return document.body.classList.contains('ada-av') ? $('#c-av').innerHTML : ''; }
function dataBlok(id, d, st, n) {
  if (id === 'jam') return { waktu: jamTeks(d, true), tanggal: d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) };
  if (id === 'pelajaran') {
    if (st.kini) return { label: 'Sekarang', judul: st.kini.mapel, detail: `${fmtMin(st.kini.s)}–${fmtMin(st.kini.e)} · ${st.kini.jp} JP${st.kini.ket ? ' · ' + st.kini.ket : ''}`,
      sisa: `sisa ${Math.ceil(st.kini.e - n)} menit`, prog: (n - st.kini.s) / (st.kini.e - st.kini.s) * 100,
      lanjut: st.next ? `Berikutnya ${st.next.mapel} ${fmtMin(st.next.s)}` : '', ikon: '📘' };
    if (!st.list.length) { const ih = infoHariIni(d); return { label: 'Hari ini', judul: !ih.sekolah ? 'Libur' : 'Tidak ada jadwal', detail: !ih.sekolah ? ih.alasan : '', ikon: '🏖️' }; }
    if (!st.next) return { label: 'Hari ini', judul: 'Pelajaran selesai', detail: `${st.list.length} kegiatan sudah lewat`, ikon: '✅' };
    return { label: 'Berikutnya', judul: st.next.mapel, detail: `mulai ${fmtMin(st.next.s)}`, sisa: `${Math.ceil(st.next.s - n)} menit lagi`, ikon: '➜' };
  }
  if (id === 'sholat') {
    const sh = sholatHari(d); if (!sh.length) return null;
    let nx = sh.find(x => x.m > n), besok = false;
    if (!nx) { nx = sholatHari(new Date(d.getTime() + 864e5))[0]; besok = true; }
    const sisa = besok ? 'besok' : (nx.m - n < 60 ? `${Math.ceil(nx.m - n)} menit lagi` : `${Math.floor((nx.m - n) / 60)} jam ${Math.round((nx.m - n) % 60)} mnt lagi`);
    return { list: sh, next: nx, besok, sisa, nama: nx.nama.split('/')[0] };
  }
  if (id === 'cuaca') {
    if ((cfg.cuaca || {}).aktif === false || !cuaca) return null;
    const [ik, ket] = B.cuacaKode(cuaca.kode, cuaca.siang);
    const hujan = cuacaJam(d).slice(0, 6).find(h => h.hujan >= 50);
    return { ikon: ik, suhu: Math.round(cuaca.suhu), ket, catatan: hujan ? `☔ Hujan ${hujan.hujan}% ±${String(new Date(hujan.t).getHours()).padStart(2, '0')}:00` : `Terasa ${Math.round(cuaca.terasa)}° · lembap ${cuaca.lembap}%`, hujan: !!hujan };
  }
  if (id === 'baterai') {
    if (!battery) return null;
    return { lv: Math.round(battery.level * 100), cas: battery.charging, lemah: batLemah() };
  }
  if (id === 'kehadiran') {
    const dt = bkData(); if (!dt) return { belum: true };
    const ab = dt.tgl === B.tglStr(d) ? dt.absen : {};
    const tidak = dt.siswa.filter(s => ab[s.id]).map(s => `${s.lengkap.split(' ')[0]} (${({ 1: 'S', 2: 'I', 3: 'A' })[ab[s.id]]})`);
    return { hadir: dt.siswa.length - tidak.length, total: dt.siswa.length, tidak };
  }
  return null;
}
function satuBaris(id, x) {
  if (!x) return '';
  if (id === 'pelajaran') return `<span class="ik">${x.ikon}</span><span><b>${esc(x.judul)}</b>${x.sisa ? ` · ${esc(x.sisa)}` : (x.detail ? ` · ${esc(x.detail)}` : '')}</span>`;
  if (id === 'sholat') return `<span class="ik">🕌</span><span><b>${esc(x.nama)} ${fmtMin(x.next.m)}</b> · ${x.sisa}</span>`;
  if (id === 'cuaca') return `<span class="ik">${x.ikon}</span><span><b>${x.suhu}°</b> ${esc(x.ket)} · <span class="${x.hujan ? 'hujan' : 'muted'}">${esc(x.catatan)}</span></span>`;
  if (id === 'baterai') return `<span class="ik">${x.cas ? '⚡' : (x.lemah ? '🪫' : '🔋')}</span><span class="${x.lemah ? 'bat-low' : ''}"><b>${x.lv}%</b> · ${x.cas ? 'sedang mengisi' : (x.lemah ? 'segera isi daya' : 'baterai')}</span>`;
  if (id === 'kehadiran') return x.belum ? `<span class="ik">👧</span><span class="muted">Kehadiran: masuk ke BukuKelas dulu</span>` : `<span class="ik">👧</span><span><b>${x.hadir}/${x.total} hadir</b>${x.tidak.length ? ' · ' + esc(x.tidak.join(', ')) : ''}</span>`;
  return '';
}
function kotak(id, x) {
  if (!x) return '';
  const bungkus = (isi, kelas = '') => `<div class="tile ${kelas}">${isi}</div>`;
  if (id === 'jam') return bungkus(`<div class="t-jam">${x.waktu}</div><div class="muted t-kecil">${esc(x.tanggal)}</div>${htmlKarakter() ? `<span class="t-av">${htmlKarakter()}</span>` : ''}`, 'jam');
  if (id === 'pelajaran') return bungkus(`<div class="t-label">${x.ikon} ${esc(x.label)}</div><div class="t-judul">${esc(x.judul)}</div><div class="muted t-kecil">${esc(x.sisa || x.detail || '')}</div>${x.prog !== undefined ? `<div class="prog"><div style="width:${x.prog}%"></div></div>` : ''}`);
  if (id === 'sholat') return bungkus(`<div class="t-label">🕌 Sholat ${x.besok ? 'besok' : 'berikutnya'}</div><div class="t-judul">${esc(x.nama)} ${fmtMin(x.next.m)}</div><div class="muted t-kecil">${x.sisa}</div>`);
  if (id === 'cuaca') return bungkus(`<div class="t-label">Cuaca</div><div class="t-judul">${x.ikon} ${x.suhu}° <span class="t-kecil">${esc(x.ket)}</span></div><div class="t-kecil ${x.hujan ? 'hujan' : 'muted'}">${esc(x.catatan)}</div>`);
  if (id === 'baterai') return bungkus(`<div class="t-label">Baterai</div><div class="t-judul ${x.lemah ? 'bat-low' : ''}">${x.cas ? '⚡' : (x.lemah ? '🪫' : '🔋')} ${x.lv}%</div><div class="prog bat"><div style="width:${x.lv}%"></div></div>`);
  if (id === 'kehadiran') return x.belum ? bungkus(`<div class="t-label">👧 Kehadiran</div><div class="muted t-kecil">Masuk ke BukuKelas dulu</div>`)
    : bungkus(`<div class="t-label">👧 Kehadiran</div><div class="t-judul">${x.hadir}/${x.total} hadir</div><div class="muted t-kecil">${x.tidak.length ? esc(x.tidak.join(', ')) : 'Semua hadir'}</div>`);
  return '';
}
function renderBeranda(d, st, n) {
  const { tata, blok } = aturBeranda();
  const data = Object.fromEntries(blok.map(id => [id, dataBlok(id, d, st, n)]));
  const lain = blok.filter(id => id !== 'jam' && data[id]);
  const offline = !internet.online ? `<div class="b-off off">⚠ Internet terputus sejak ${fmtMin(Math.floor(nowMin(new Date(internet.sejak))))}</div>` : '';
  let html = '';
  if (tata === 'kotak') {
    const tiles = blok.map(id => kotak(id, data[id])).filter(Boolean);
    html = `<div class="b-kotak${tiles.length % 2 ? ' ganjil' : ''}">${tiles.join('')}</div>`;
  } else if (tata === 'daftar') {
    const kiri = data.jam ? `<div class="b-kiri">${htmlKarakter() ? `<span class="b-av">${htmlKarakter()}</span>` : ''}<div class="b-jam">${data.jam.waktu}</div><div class="muted t-kecil">${esc(data.jam.tanggal)}</div></div>` : '';
    html = `<div class="b-daftar${kiri ? '' : ' penuh'}">${kiri}<ul>${lain.map(id => `<li>${satuBaris(id, data[id])}</li>`).join('')}</ul></div>`;
  } else if (tata === 'minimal') {
    html = `<div class="b-minimal">${data.jam ? `<div class="b-baris">${htmlKarakter() ? `<span class="b-av">${htmlKarakter()}</span>` : ''}<div><div class="b-jam besar">${data.jam.waktu}</div><div class="muted">${esc(data.jam.tanggal)}</div></div></div>` : ''}
      <div class="b-ringkas">${lain.slice(0, 2).map(id => `<div>${satuBaris(id, data[id])}</div>`).join('')}</div></div>`;
  } else { // klasik
    html = `<div class="b-klasik">${blok.map(id => {
      const x = data[id]; if (!x) return '';
      if (id === 'jam') return `<div class="k-jam"><div><div class="b-jam">${x.waktu}</div><div class="muted t-kecil">${esc(x.tanggal)}</div></div>${htmlKarakter() ? `<span class="b-av">${htmlKarakter()}</span>` : ''}</div>`;
      if (id === 'pelajaran') return `<div class="card"><span class="muted">${esc(x.label)}</span><b>${esc(x.judul)}</b>${esc([x.detail, x.sisa].filter(Boolean).join(' · '))}${x.prog !== undefined ? `<div class="prog"><div style="width:${x.prog}%"></div></div>` : ''}</div>`;
      if (id === 'sholat') return `<div class="k-sholat">${x.list.map(s => `<div class="${!x.besok && s.k === x.next.k ? 'next' : ''}">${s.nama.split('/')[0]}<b>${fmtMin(s.m)}</b></div>`).join('')}</div>`;
      return `<div class="k-baris">${satuBaris(id, x)}</div>`;
    }).join('')}</div>`;
  }
  $('#beranda').innerHTML = html + offline;
}

// ---------- Cuaca ----------
let cuaca = null;
window.api.onCuaca(c => { cuaca = c; render(new Date()); });
window.api.cuaca().then(c => { cuaca = c; });
function cuacaJam(d) {
  if (!cuaca || !cuaca.jam) return [];
  const kini = d.getTime() - 3600 * 1000;
  return cuaca.jam.filter(h => new Date(h.t).getTime() >= kini);
}
function cuacaTeks(d) {
  const c = cfg.cuaca || {};
  if (c.aktif === false || !cuaca) return '';
  const [ik, ket] = B.cuacaKode(cuaca.kode, cuaca.siang);
  const lama = Date.now() - cuaca.waktu > 3 * 3600 * 1000;
  const hujan = cuacaJam(d).slice(0, 6).find(h => h.hujan >= 50);
  const baris2 = hujan
    ? `<span class="hujan">☔ Hujan ${hujan.hujan}% ±${String(new Date(hujan.t).getHours()).padStart(2, '0')}:00</span>`
    : `<span class="muted">Terasa ${Math.round(cuaca.terasa)}° · lembap ${cuaca.lembap}%</span>`;
  return `${ik} <b>${Math.round(cuaca.suhu)}°</b> ${ket}${lama ? ' <span class="muted">(lama)</span>' : ''}<br>${baris2}`;
}
// Catatan hujan untuk kegiatan luar kelas (PJOK, upacara, senam, Adiwiyata)
function catatanHujan(x) {
  if (!cuaca || (cfg.cuaca || {}).peringatanHujan === false || !/pjok|upacara|senam|olahraga|adiwiyata|lapangan/i.test(x.mapel + ' ' + (x.ket || ''))) return '';
  const jamMulai = Math.floor(x.s / 60);
  const h = (cuaca.jam || []).find(j => new Date(j.t).getHours() === jamMulai && new Date(j.t).toDateString() === new Date().toDateString());
  return h && h.hujan >= 50 ? ` · ☔ kemungkinan hujan ${h.hujan}%` : '';
}

// ---------- Baterai: peringatan ----------
const batSudah = new Set();
function cekBaterai() {
  if (!cfg) return;
  const b = (cfg.pengingat || {}).baterai || {};
  if (!cfg || !battery || b.aktif === false) return;
  const lv = Math.round(battery.level * 100);
  if (battery.charging) { batSudah.clear(); return; }
  const kritis = Number(b.kritis) || 10, batas = Number(b.batas) || 20;
  if (lv <= kritis && !batSudah.has('k')) { batSudah.add('k'); batSudah.add('b'); pushAlert('Baterai hampir habis 🪫', `Tinggal ${lv}%. Colokkan charger sekarang agar laptop tidak mati di tengah pelajaran.`); }
  else if (lv <= batas && !batSudah.has('b')) { batSudah.add('b'); pushAlert('Baterai lemah 🔋', `Tinggal ${lv}%. Sebaiknya colokkan charger.`); }
}

// ---------- Kalender ----------
function renderKalender(d) {
  if (!kalBulan) kalBulan = new Date(d.getFullYear(), d.getMonth(), 1);
  const th = kalBulan.getFullYear(), bl = kalBulan.getMonth();
  $('#kal-judul').textContent = `${B.BULAN[bl]} ${th}`;
  const presensi = bkData() ? bkData().presensi : null;
  const hariIni = B.tglStr(d);
  // Senin sebagai awal minggu
  const awal = new Date(th, bl, 1); awal.setDate(1 - ((awal.getDay() + 6) % 7));
  let html = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((h, i) => `<span class="hd${i === 6 ? ' mg' : ''}">${h}</span>`).join('');
  for (let i = 0; i < 42; i++) {
    const t = new Date(awal); t.setDate(awal.getDate() + i);
    const ts = B.tglStr(t), info = B.infoHari(ts, presensi);
    const sekolahLibur = presensi && (presensi.libur || []).some(l => ts >= l.tgl && ts <= (l.sampai || l.tgl));
    const cls = [t.getMonth() !== bl ? 'luar' : '', !info.sekolah ? 'libur' : '', sekolahLibur ? 'sekolah' : '', ts === hariIni ? 'ini' : '', ts === kalPilih ? 'pilih' : ''].join(' ');
    const ag = B.kaldikTanggal(ts).filter(x => x.jenis !== 'libur')[0];
    html += `<button class="${cls}${ag ? ' agenda' : ''}" data-t="${ts}" title="${esc([info.alasan, ...B.kaldikTanggal(ts).map(x => x.nama)].filter(Boolean).join(' · '))}"${ag ? ` style="--ag:${B.JENIS_KALDIK[ag.jenis][1]}"` : ''}>${t.getDate()}</button>`;
  }
  $('#kal-grid').innerHTML = html;
  // daftar libur bulan ini, atau keterangan tanggal yang dipilih
  if (kalPilih) {
    const info = B.infoHari(kalPilih, presensi);
    const ag = B.kaldikTanggal(kalPilih).filter(x => x.jenis !== 'libur').map(x => x.nama);
    $('#kal-info').textContent = `${B.tglPanjang(kalPilih)} · ${info.sekolah ? 'Hari sekolah' : 'Libur: ' + info.alasan}${ag.length ? ' · ' + ag.join(', ') : ''}`;
  } else {
    const libur = [];
    for (let t = new Date(th, bl, 1); t.getMonth() === bl; t.setDate(t.getDate() + 1)) {
      const ts = B.tglStr(t), info = B.infoHari(ts, presensi);
      if (!info.sekolah && t.getDay() !== 0) libur.push(`${t.getDate()} ${info.alasan}`);
    }
    $('#kal-info').textContent = libur.length ? 'Libur: ' + libur.join(' · ') : 'Tidak ada libur selain hari Minggu.';
  }
}
$('#kal-grid').addEventListener('click', e => {
  const b = e.target.closest('button[data-t]'); if (!b) return;
  kalPilih = kalPilih === b.dataset.t ? null : b.dataset.t;
  render(new Date());
});
$('#kal-prev').addEventListener('click', () => { kalBulan = new Date(kalBulan.getFullYear(), kalBulan.getMonth() - 1, 1); kalPilih = null; render(new Date()); });
$('#kal-next').addEventListener('click', () => { kalBulan = new Date(kalBulan.getFullYear(), kalBulan.getMonth() + 1, 1); kalPilih = null; render(new Date()); });
$('#kal-ini').addEventListener('click', () => { kalBulan = null; kalPilih = null; render(new Date()); });

// ---------- Volume & kecerahan ----------
let slTahan = 0;
function renderKontrol() {
  const k = kontrolSt;
  const vol = $('#sl-vol'), bri = $('#sl-bri');
  if (!k) { $('#sl-info').textContent = 'Memuat…'; return; }
  if (Date.now() - slTahan > 800) {
    if (k.vol !== null && k.vol !== undefined) vol.value = k.vol;
    if (k.bri !== null && k.bri !== undefined) bri.value = k.bri;
  }
  vol.disabled = k.vol === null || k.vol === undefined;
  bri.disabled = k.bri === null || k.bri === undefined;
  $('#sl-vol-v').textContent = vol.disabled ? '–' : (k.mute ? 'senyap' : vol.value + '%');
  $('#sl-bri-v').textContent = bri.disabled ? '–' : bri.value + '%';
  $('#sl-mute').textContent = k.mute ? '🔇' : '🔊';
  $('#sl-info').textContent = k.galat || (bri.disabled ? 'Kecerahan tidak bisa diatur pada layar ini (misalnya monitor eksternal).' : '');
}
let tVol, tBri;
$('#sl-vol').addEventListener('input', e => { slTahan = Date.now(); $('#sl-vol-v').textContent = e.target.value + '%'; clearTimeout(tVol); tVol = setTimeout(() => window.api.kontrol('vol ' + e.target.value), 120); });
$('#sl-bri').addEventListener('input', e => { slTahan = Date.now(); $('#sl-bri-v').textContent = e.target.value + '%'; clearTimeout(tBri); tBri = setTimeout(() => window.api.kontrol('bri ' + e.target.value), 200); });
$('#sl-mute').addEventListener('click', () => window.api.kontrol('mute ' + (kontrolSt && kontrolSt.mute ? 0 : 1)));
window.api.onKontrol(k => { kontrolSt = k; if (mode === 'expanded') renderKontrol(); });

// ---------- Internet ----------
let internetAlert = false;
function terimaInternet(i) {
  const tadi = internet.online;
  internet = i;
  if (cfg && (cfg.pengingat || {}).internet !== false) {
    if (!i.online && tadi) { internetAlert = true; pushAlert('Internet terputus', 'Data BukuKelas yang diisi tetap tersimpan di laptop dan dikirim saat tersambung lagi.'); }
    if (i.online && !tadi && internetAlert) { internetAlert = false; pushAlert('Internet tersambung kembali', 'Perubahan yang tertunda sedang dikirim.'); }
  }
  render(new Date());
}
window.api.onInternet(terimaInternet);

// ---------- Kelas (BukuKelas) ----------
function hadirSiswa() {
  const d = bkData(); if (!d) return [];
  const ab = d.tgl === B.tglStr(new Date()) ? d.absen : {};
  return d.siswa.filter(s => !ab[s.id]);
}
function renderKelas() {
  const d = bkData();
  $('#k-off').hidden = !!d;
  $('#k-on').hidden = !d;
  if (!d) return;
  const ab = d.tgl === B.tglStr(new Date()) ? d.absen : {};
  const tidak = d.siswa.filter(s => ab[s.id]).map(s => `${s.lengkap} (${({ 1: 'S', 2: 'I', 3: 'A' })[ab[s.id]]})`);
  const antre = bkSt.antrean ? ` · ${bkSt.antrean} menunggu terkirim` : '';
  $('#k-head').innerHTML = `Kelas ${esc(d.kelas)} · ${d.siswa.length} siswa · <b style="color:var(--aksen)">${d.siswa.length - tidak.length} hadir</b>${antre}<br>${tidak.length ? 'Tidak hadir: ' + esc(tidak.join(', ')) : 'Semua hadir'}`;
}
$('#k-acak-btn').addEventListener('click', async () => {
  let pool = hadirSiswa().filter(s => !acakSudah.includes(s.id));
  if (!pool.length) { acakSudah.length = 0; pool = hadirSiswa(); }
  if (!pool.length) return;
  const el = $('#k-nama'), btn = $('#k-acak-btn');
  btn.disabled = true; el.classList.add('putar');
  const pilih = pool[Math.floor(Math.random() * pool.length)];
  for (let i = 0; i < 12; i++) { el.textContent = pool[Math.floor(Math.random() * pool.length)].lengkap; await new Promise(r => setTimeout(r, 40 + i * 12)); }
  el.textContent = pilih.lengkap; el.classList.remove('putar');
  acakSudah.push(pilih.id);
  btn.disabled = false;
  btn.textContent = `Acak lagi (${pool.length - 1} tersisa)`;
});
$$('[data-kelas]').forEach(b => b.addEventListener('click', () => window.api.openKelas({ tab: b.dataset.kelas })));
window.api.bk.onStatus(s => { bkSt = s; render(new Date()); });

// ---------- Pembaruan ----------
window.api.onUpdateSiap(v => pushAlert(`Versi ${v} siap dipasang ✨`, 'Pembaruan Dynamic Island sudah diunduh. Pasang sekarang? (sekitar 10 detik, pengaturan tidak berubah)',
  { label: 'Pasang sekarang', fn: () => window.api.pasangUpdate() }));

// ---------- Mulai ----------
function terapkan(c) { cfg = c; B.setKaldik(c.kaldik); applyTheme(); renderKarakter(); renderPresets(); renderPintasan(); render(new Date()); }
window.api.onConfig(terapkan);
window.api.bk.status().then(s => { bkSt = s; });
window.api.internet().then(i => { internet = i; });
window.api.getConfig().then(c => {
  terapkan(c);
  setInterval(() => { const d = new Date(); timerTick(); cekPengingat(d); render(d); }, 1000);
});
