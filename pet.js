'use strict';
/* Pet interaktif Dynamic Island.
   Jendela transparan selebar layar di atas taskbar. Pet berjalan, duduk, tidur, menoleh ke kursor,
   bisa diklik (senang), diklik dua kali (berputar), diangkat lalu dilempar (jatuh & memantul),
   dan sesekali mengingatkan: pelajaran mulai, waktu sholat, mau hujan, tugas hari ini, ulang tahun siswa. */
const B = window.Bersama;
const $ = s => document.querySelector(s);
const pet = $('#pet'), badan = $('#badan'), gambar = $('#gambar'), gelembung = $('#gelembung'), aksesori = $('#aksesori'), efek = $('#efek');

let cfg = null, cuaca = null, bkSt = null;
const KECEPATAN = { pelan: 38, normal: 62, cepat: 96 };   // px per detik
const GRAVITASI = 1500;

// ---------- Posisi & keadaan ----------
let W = innerWidth, H = innerHeight, S = 90;
let x = Math.round(W * 0.7), y = 0, vx = 0, vy = 0;   // y = tinggi di atas "lantai" (taskbar)
let arah = 1;                       // 1 menghadap kanan, -1 kiri
let keadaan = 'diam', sampai = 0;   // sampai = waktu (ms) keadaan berakhir
let targetX = x;
let interaksiTerakhir = Date.now();
let pegang = null;                  // data saat diangkat mouse

const pet_ = () => cfg && cfg.pet ? cfg.pet : {};
const sekarang = () => Date.now();
const acak = (a, b) => a + Math.random() * (b - a);
const pilih = arr => arr[Math.floor(Math.random() * arr.length)];

function setKeadaan(k, lamaMs) {
  keadaan = k;
  sampai = lamaMs ? sekarang() + lamaMs : 0;
  pet.className = k;
  aturAksesori();
}
function malam() { const h = new Date().getHours(); return h >= 21 || h < 5; }

/** Pilih kegiatan berikutnya secara acak (berjalan, diam, duduk, tidur). */
function aksiBerikutnya() {
  const p = pet_();
  const lamaDiam = sekarang() - interaksiTerakhir;
  if ((p.tidurMalam !== false && malam() && Math.random() < 0.85) || (lamaDiam > 15 * 60 * 1000 && Math.random() < 0.5)) {
    setKeadaan('tidur', acak(60, 180) * 1000); return;
  }
  const r = Math.random();
  if (r < 0.45) {
    targetX = Math.round(acak(10, W - S - 10));
    if (Math.abs(targetX - x) < 60) targetX = x > W / 2 ? x - 160 : x + 160;
    targetX = Math.max(10, Math.min(W - S - 10, targetX));
    setKeadaan('jalan');
  } else if (r < 0.75) setKeadaan('diam', acak(3, 8) * 1000);
  else setKeadaan('duduk', acak(5, 12) * 1000);
}

// ---------- Gambar karakter ----------
async function pasangGambar() {
  const p = pet_();
  let id = p.karakter && p.karakter !== 'ikut' ? p.karakter : (cfg.tampilan || {}).karakter;
  id = window.karakterId(id);
  if (id === 'none') id = window.KARAKTER_BAWAAN;
  if (id.startsWith('u:')) {
    const data = await window.api.karakterData(id).catch(() => null);
    gambar.src = data || window.KARAKTER[window.KARAKTER_BAWAAN].src;
  } else gambar.src = (window.KARAKTER[id] || window.KARAKTER[window.KARAKTER_BAWAAN]).src;
  S = Math.max(40, Math.min(180, Number(p.ukuran) || 90));
  document.documentElement.style.setProperty('--s', S + 'px');
  x = Math.max(0, Math.min(W - S, x));
}

// ---------- Gelembung bicara & partikel ----------
let tGelembung = null;
function bicara(teks, lama = 5500) {
  if (pet_().bicara === false || !teks) return;
  gelembung.textContent = teks;
  gelembung.hidden = false;
  gelembung.classList.toggle('kiri', x < 120);
  gelembung.classList.toggle('kanan', x > W - S - 120);
  clearTimeout(tGelembung);
  tGelembung = setTimeout(() => { gelembung.hidden = true; }, lama);
}
function partikel(isi, n = 4, kelas = '') {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'partikel ' + kelas;
    el.textContent = isi;
    el.style.left = (x + S / 2 + acak(-S * 0.35, S * 0.25)) + 'px';
    el.style.top = (H - y - S * 0.85) + 'px';
    el.style.setProperty('--dx', acak(-30, 30) + 'px');
    el.style.animationDelay = (i * 0.12) + 's';
    efek.appendChild(el);
    setTimeout(() => el.remove(), 2600 + i * 120);
  }
}

// ---------- Aksesori (payung saat mau hujan, topi pesta saat ada yang ulang tahun) ----------
let mauHujan = false, adaUlangTahun = false;
function aturAksesori() {
  aksesori.textContent = keadaan === 'tidur' ? '' : (adaUlangTahun ? '🥳' : (mauHujan ? '☂️' : ''));
}

// ---------- Gerak (dijalankan tiap frame) ----------
let tLalu = performance.now(), tZzz = 0;
function langkah(t) {
  const dt = Math.min(0.05, (t - tLalu) / 1000); tLalu = t;
  if (cfg && !pegang) {
    if (keadaan === 'udara') {
      vy -= GRAVITASI * dt; x += vx * dt; y += vy * dt;
      if (x < 0) { x = 0; vx = -vx * 0.6; } if (x > W - S) { x = W - S; vx = -vx * 0.6; }
      if (y > H - S) { y = H - S; vy = -Math.abs(vy) * 0.3; }
      if (y <= 0) {
        y = 0;
        if (Math.abs(vy) > 380) { vy = -vy * 0.38; vx *= 0.7; }            // memantul
        else { vy = 0; vx = 0; setKeadaan('mendarat', 320); if (Math.random() < 0.5) bicara(pilih(['Aduh! 😵', 'Hup! 😆', 'Lagi dong! 😄', 'Wuuush~'])); }
      }
      if (vx) arah = vx > 0 ? 1 : -1;
    } else if (keadaan === 'jalan') {
      const kec = KECEPATAN[pet_().kecepatan] || KECEPATAN.normal;
      const d = targetX - x;
      arah = d > 0 ? 1 : -1;
      x += Math.sign(d) * Math.min(Math.abs(d), kec * dt);
      if (Math.abs(targetX - x) < 1) aksiBerikutnya();
    } else if (keadaan === 'diangkat') { setKeadaan('udara'); }   // jaga-jaga: bila pelepasan mouse terlewat
    else if (sampai && sekarang() > sampai) aksiBerikutnya();
    if (keadaan === 'tidur' && t - tZzz > 1700) { tZzz = t; partikel('z', 1, 'zzz'); }
  }
  pet.style.transform = `translate(${Math.round(x)}px, ${Math.round(-y)}px)`;
  gambar.style.setProperty('--arah', arah);
  requestAnimationFrame(langkah);
}

// ---------- Interaksi mouse ----------
// Jendela tembus klik; begitu kursor di atas pet, jendela "menangkap" mouse agar pet bisa diklik/diangkat.
let tangkap = false;
function setTangkap(v) { if (v !== tangkap) { tangkap = v; window.api.petTangkap(v); } }
pet.addEventListener('mouseenter', () => setTangkap(true));
pet.addEventListener('mouseleave', () => { if (!pegang) setTangkap(false); });

let mx = 0, my = 0;
window.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  // menoleh ke kursor bila dekat dan sedang santai
  if (!pegang && ['diam', 'duduk', 'lihat'].includes(keadaan)) {
    const cx = x + S / 2, jarak = Math.abs(mx - cx);
    if (jarak < 260 && Math.abs(my - (H - y - S / 2)) < 220) arah = mx > cx ? 1 : -1;
  }
});

pet.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  e.preventDefault();
  try { pet.setPointerCapture(e.pointerId); } catch { /* lanjut */ }
  const r = pet.getBoundingClientRect();
  pegang = { ox: e.clientX - r.left, oy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, t0: sekarang(), jejak: [], gerak: false };
  interaksiTerakhir = sekarang();
});
window.addEventListener('pointermove', e => {
  if (!pegang) return;
  if (!pegang.gerak && Math.hypot(e.clientX - pegang.x0, e.clientY - pegang.y0) > 6) {
    pegang.gerak = true; pet.classList.add('pegang'); setKeadaan('diangkat'); pet.classList.add('pegang', 'udara');
    gelembung.hidden = true;
    if (Math.random() < 0.6) bicara(pilih(['Waaa! Mau ke mana? 😳', 'Hihi, geli! 🤭', 'Turunkan aku~ 🥺', 'Terbaaang! ✈️']), 2500);
  }
  if (!pegang.gerak) return;
  x = Math.max(0, Math.min(W - S, e.clientX - pegang.ox));
  y = Math.max(0, Math.min(H - S, H - (e.clientY - pegang.oy) - S));
  pegang.jejak.push({ t: performance.now(), x: e.clientX, y: e.clientY });
  if (pegang.jejak.length > 6) pegang.jejak.shift();
  // badan berayun mengikuti arah tarikan
  const j = pegang.jejak, a = j[0], b = j[j.length - 1];
  const miring = a && b ? Math.max(-25, Math.min(25, (b.x - a.x) * 0.6)) : 0;
  badan.style.transform = `rotate(${-miring}deg)`;
});
function lepas(e) {
  if (!pegang) return;
  const p = pegang; pegang = null;
  badan.style.transform = '';
  pet.classList.remove('pegang');
  if (p.gerak) {
    const j = p.jejak, a = j[0], b = j[j.length - 1];
    const dt = a && b ? Math.max(0.016, (b.t - a.t) / 1000) : 1;
    vx = a && b ? Math.max(-1400, Math.min(1400, (b.x - a.x) / dt)) : 0;
    vy = a && b ? Math.max(-900, Math.min(1400, -(b.y - a.y) / dt)) : 0;
    setKeadaan('udara'); pet.classList.add('udara');
  } else klik();
  const r = pet.getBoundingClientRect();
  if (!(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)) setTangkap(false);
}
window.addEventListener('pointerup', lepas);
window.addEventListener('pointercancel', lepas);
window.addEventListener('blur', () => { if (pegang) lepas({ clientX: -1, clientY: -1 }); });

// klik sekali = senang; klik dua kali cepat = berputar
let tKlik = null;
function klik() {
  interaksiTerakhir = sekarang();
  if (tKlik) { clearTimeout(tKlik); tKlik = null; setKeadaan('putar', 720); partikel('✨', 5); bicara(pilih(['Wiiii! 🌀', 'Pusiiing~ 😵‍💫', 'Lihat aku berputar! ✨'])); return; }
  tKlik = setTimeout(() => {
    tKlik = null;
    if (keadaan === 'tidur') { setKeadaan('diam', 4000); bicara(pilih(['Hoaam… sudah pagi? 😪', 'Eh, aku ketiduran 😅', 'Lima menit lagi… 😴'])); return; }
    setKeadaan('senang', 800); partikel(pilih(['💜', '💖', '🌸']), 4);
    bicara(pilih(['Hai, Bu Guru! 👋', 'Semangat mengajar! 💪', 'Aku sayang Ibu! 💖', 'Hehe, geli! 😆', 'Sudah minum air? 💧', 'Ibu hebat hari ini! 🌟']));
  }, 260);
}

// ---------- Peristiwa: pelajaran, sholat, hujan, tugas, ulang tahun, sapaan ----------
const sudah = new Set();
let sapaanBerikut = sekarang() + acak(8, 15) * 60 * 1000;
function sekali(kunci, fn) { if (!sudah.has(kunci)) { sudah.add(kunci); fn(); } }
function cekPeristiwa() {
  if (!cfg) return;
  const d = new Date(), hari = B.tglStr(d), n = d.getHours() * 60 + d.getMinutes();
  const presensi = bkSt && bkSt.masuk && bkSt.data ? bkSt.data.presensi : null;
  const info = B.infoHari(hari, presensi);
  // pelajaran / istirahat dimulai
  if (info.sekolah) for (const j of B.jadwalHari(cfg, d)) {
    if (Math.floor(j.s) !== n) continue;
    sekali(`${hari}|j${j.s}`, () => {
      if (j.pelajaran) { bicara(`Waktunya ${j.mapel}! 📚`); setKeadaan('senang', 800); }
      else if (/istirahat/i.test(j.mapel)) bicara('Istirahat dulu yuk 🍎');
    });
  }
  // waktu sholat
  const sh = cfg.sholat || {};
  if (sh.aktif !== false) {
    const w = B.waktuSholat(d, Number(sh.lat) || -0.48, Number(sh.lon) || 102.44, 7);
    for (const [k, nama] of B.NAMA_SHOLAT) if (Math.floor(w[k]) === n) sekali(`${hari}|s${k}`, () => { bicara(`Sudah masuk waktu ${d.getDay() === 5 && k === 'dzuhur' ? 'Jumat' : nama} 🕌`, 8000); setKeadaan('duduk', 20000); });
  }
  // mau hujan (kemungkinan ≥ 50% di jam ini)
  const jamIni = cuaca && Array.isArray(cuaca.jam) ? cuaca.jam.find(h => new Date(h.t).getHours() === d.getHours() && B.tglStr(new Date(h.t)) === hari) : null;
  mauHujan = !!(jamIni && jamIni.hujan >= 50);
  if (mauHujan) sekali(`${hari}|h${Math.floor(d.getHours() / 2)}`, () => bicara(`Sedia payung ya, mau hujan ${jamIni.hujan}% ☔`));
  // tugas yang jatuh tempo (sekali sehari mulai 07.00)
  if (n >= 7 * 60 && Array.isArray(cfg.tugas)) {
    const jatuh = cfg.tugas.filter(t => !t.selesai && t.tenggat && t.tenggat <= hari);
    if (jatuh.length) sekali(`${hari}|tugas`, () => bicara(`Ada ${jatuh.length} tugas yang jatuh tempo ✅`, 7000));
  }
  // ulang tahun siswa hari ini
  const siswa = bkSt && bkSt.masuk && bkSt.data ? bkSt.data.siswa || [] : [];
  const ultah = siswa.filter(s => s.lahir && s.lahir.slice(5) === hari.slice(5));
  adaUlangTahun = ultah.length > 0;
  if (adaUlangTahun && n >= 6 * 60 + 30) sekali(`${hari}|ultah`, () => { bicara(`Hari ini ${ultah.map(s => s.panggilan || s.nama).join(', ')} ulang tahun! 🎂`, 9000); partikel('🎉', 5); });
  aturAksesori();
  // sapaan sesekali (06.00–20.00)
  if (sekarang() > sapaanBerikut) {
    sapaanBerikut = sekarang() + acak(12, 25) * 60 * 1000;
    if (n >= 360 && n <= 1200 && keadaan !== 'tidur' && Math.random() < 0.7)
      bicara(pilih(['Jangan lupa minum air ya 💧', 'Istirahatkan mata sebentar 👀', 'Semangat, Bu Guru! 💪', 'Senyum dulu dong 😊', 'Aku temani Ibu kerja ya 🤗', 'Peregangan sebentar yuk 🙆']));
  }
}

// ---------- Mulai ----------
function ukurLayar() { W = innerWidth; H = innerHeight; x = Math.max(0, Math.min(W - S, x)); }
window.addEventListener('resize', ukurLayar);
window.api.onConfig(async c => { cfg = c; B.setKaldik(c.kaldik); await pasangGambar(); });
window.api.onCuaca(c => { cuaca = c; });
window.api.bk.onStatus(st => { bkSt = st; });
(async () => {
  cfg = await window.api.getConfig();
  cuaca = await window.api.cuaca().catch(() => null);
  try { bkSt = await window.api.bk.status(); } catch { bkSt = null; }
  B.setKaldik(cfg.kaldik);
  await pasangGambar();
  ukurLayar();
  setKeadaan('diam', 2500);
  setTimeout(() => bicara(malam() ? 'Selamat malam, Bu Guru 🌙' : 'Halo, Bu Guru! 👋'), 1200);
  requestAnimationFrame(langkah);
  setInterval(cekPeristiwa, 15 * 1000);
  cekPeristiwa();
})();
