'use strict';
/* Pet kucing Dynamic Island (sprite dari assets/kucing).
   Jendela transparan selebar layar di atas taskbar; hanya gambar kucing yang menangkap mouse.
   Perilaku: duduk bernapas & berkedip, menoleh ke kursor, berjalan, kadang menghampiri kursor, tidur (malam / lama tak disentuh).
   Interaksi: klik = senang, klik dua kali = berputar lalu pusing, seret = tergantung kaget, lempar = jatuh & memantul, elus = keenakan.
   Pengingat lewat gelembung: pelajaran, istirahat, sholat, hujan (payung), tugas, ulang tahun siswa (topi pesta), sapaan. */
const B = window.Bersama, META = window.SPRITE_KUCING;
const $ = s => document.querySelector(s);
const pet = $('#pet'), img = $('#gambar'), gelembung = $('#gelembung'), aksesori = $('#aksesori'), efek = $('#efek'), bayangan = $('#bayangan');

let cfg = null, cuaca = null, bkSt = null;
const KECEPATAN = { pelan: 55, normal: 85, cepat: 125 };   // px/detik pada tinggi 140 px
const GAMBAR = {};
for (const n of Object.keys(META)) { const i = new Image(); i.src = window.srcKucing(n); GAMBAR[n] = i; }

const opsi = () => (cfg && cfg.pet) || {};
let TINGGI = 120;                                   // tinggi kucing duduk (px), dari Pengaturan → Pet
const k = () => TINGGI / 305;
let W = innerWidth, LANTAI = innerHeight - 2;
let x = Math.round(W * 0.72), y = 0, vx = 0, vy = 0, arah = 1;   // x = posisi kaki; y = tinggi di atas taskbar
let keadaan = 'diam', mulai = performance.now(), sampai = performance.now() + 2500, targetX = x;
let kedipMulai = -1, kedipBerikut = performance.now() + 2500, kedipGanda = false;
let mx = -9999, my = -9999, pegang = null, disentuh = Date.now(), remas = 0, frameKini = '';
const acak = (a, b) => a + Math.random() * (b - a);
const pilih = a => a[Math.floor(Math.random() * a.length)];
const malam = () => { const h = new Date().getHours(); return h >= 21 || h < 5; };

function setKeadaan(s, lama) { keadaan = s; mulai = performance.now(); sampai = lama ? mulai + lama : 0; }
function aksiBerikutnya() {
  const r = Math.random();
  if ((opsi().tidurMalam !== false && malam() && r < 0.85) || (Date.now() - disentuh > 15 * 60 * 1000 && r < 0.4)) { setKeadaan('ngantuk', 2600); return; }
  // sesekali penasaran menghampiri kursor yang berada di dekat taskbar
  if (mx > -999 && my > LANTAI - 260 && Math.abs(mx - x) > 160 && r < 0.3) { targetX = Math.max(50, Math.min(W - 50, mx)); setKeadaan('jalan'); return; }
  if (r < 0.5) {
    targetX = acak(60, W - 60);
    if (Math.abs(targetX - x) < 140) targetX = x > W / 2 ? x - 260 : x + 260;
    targetX = Math.max(60, Math.min(W - 60, targetX));
    setKeadaan('jalan');
  } else setKeadaan('diam', acak(4000, 10000));
}

// ---------- bicara & partikel ----------
let tBicara = null;
function bicara(teks, lama = 5000) {
  if (opsi().bicara === false || !teks) return;
  gelembung.textContent = teks; gelembung.hidden = false;
  clearTimeout(tBicara); tBicara = setTimeout(() => { gelembung.hidden = true; }, lama);
}
function partikel(isi, n = 4, kelas = '', dari = .85) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'partikel ' + kelas; el.textContent = isi;
    el.style.left = (x + acak(-TINGGI * .3, TINGGI * .2)) + 'px';
    el.style.top = (LANTAI - y - TINGGI * dari) + 'px';
    el.style.setProperty('--dx', acak(-30, 30) + 'px'); el.style.animationDelay = (i * .1) + 's';
    efek.appendChild(el); setTimeout(() => el.remove(), 2700);
  }
}

// ---------- gambar satu frame di titik jangkar (ax0, ay0) ----------
function gambar(nama, ax0, ay0, o = {}) {
  const m = META[nama], s = k();
  if (frameKini !== nama) { img.src = GAMBAR[nama].src; frameKini = nama; }
  img.style.width = m.w * s + 'px'; img.style.height = m.h * s + 'px';
  img.style.left = -m.ax * s + 'px'; img.style.top = -m.ay * s + 'px';
  pet.style.transform = `translate(${ax0}px, ${ay0}px) rotate(${o.rot || 0}deg) scale(${(o.flip ?? arah) * (o.sx || 1)}, ${o.sy || 1})`;
  return ay0 - m.ay * s * (o.sy || 1);          // tepi atas gambar (untuk gelembung & aksesori)
}

// ---------- setiap frame ----------
let tLalu = performance.now(), tZ = 0, tHati = 0;
function langkah(t) {
  requestAnimationFrame(langkah);
  if (!cfg) return;
  const dt = Math.min(.05, (t - tLalu) / 1000); tLalu = t;
  const s = k(), umur = t - mulai;

  if (!pegang) {
    if (keadaan === 'udara') {
      vy -= 1700 * dt; x += vx * dt; y += vy * dt;
      if (x < 40) { x = 40; vx = -vx * .6; } if (x > W - 40) { x = W - 40; vx = -vx * .6; }
      const maks = LANTAI - TINGGI * 1.4; if (y > maks) { y = maks; vy = -Math.abs(vy) * .3; }
      if (y <= 0) {
        y = 0;
        if (Math.abs(vy) > 520) { vy = -vy * .38; vx *= .7; remas = 1; }
        else {
          const keras = Math.abs(vx) > 520 || Math.abs(vy) > 300; vx = vy = 0; remas = 1;
          setKeadaan(keras ? 'pusing' : 'mendarat', keras ? 1700 : 450);
          if (keras) bicara('Pusiiing… 😵‍💫', 2500); else if (Math.random() < .6) bicara(pilih(['Hup! 😆', 'Lagi dong! 😄', 'Mendarat sempurna! ✨']), 2500);
        }
      }
      if (Math.abs(vx) > 30) arah = vx > 0 ? 1 : -1;
    } else if (keadaan === 'jalan') {
      const kec = (KECEPATAN[opsi().kecepatan] || KECEPATAN.normal) * (TINGGI / 140), d = targetX - x;
      if (Math.abs(d) > 3) { arah = d > 0 ? 1 : -1; x += Math.sign(d) * Math.min(Math.abs(d), kec * dt); } else aksiBerikutnya();
    } else if (keadaan === 'ngantuk' && t > sampai) setKeadaan('tidur', acak(90, 240) * 1000);
    else if (keadaan === 'tidur' && t > sampai && !(opsi().tidurMalam !== false && malam())) setKeadaan('menguap', 1100);
    else if (keadaan === 'senang' && umur > 1000) setKeadaan('diam', acak(3000, 6000));
    else if (keadaan === 'putar' && t > sampai) { setKeadaan('pusing', 1600); bicara('Pusiiing~ 😵‍💫', 2500); }
    else if (['menguap', 'mendarat', 'pusing'].includes(keadaan) && t > sampai) setKeadaan('diam', acak(3000, 6000));
    else if (keadaan === 'dielus' && t > sampai) { setKeadaan('senang'); mulai -= 520; }
    else if (keadaan === 'diam' && t > sampai) aksiBerikutnya();
  }
  remas = Math.max(0, remas - dt * 4);

  // menoleh ke kursor saat duduk santai
  if (keadaan === 'diam' && mx > -999 && Math.abs(mx - x) > 60 && Math.abs(mx - x) < 450) arah = mx > x ? 1 : -1;
  // kedip acak (kadang dua kali)
  if (keadaan === 'diam' && t > kedipBerikut) { kedipMulai = t; kedipGanda = Math.random() < .25; kedipBerikut = t + acak(2500, 6500); }
  let mata = 'kedip_1';
  if (kedipMulai > 0) {
    const i = Math.floor((t - kedipMulai) / 70);
    if (i >= 0 && i < 3) mata = ['kedip_2', 'kedip_3', 'kedip_2'][i];
    else if (i >= 3) { if (kedipGanda) { kedipGanda = false; kedipMulai = t + 90; } else kedipMulai = -1; }
  }

  const lantaiY = LANTAI - y, napas = Math.sin(t / 1000 * 2 * Math.PI / 2.6);
  let atas, lebarBayangan = TINGGI * .55, opBayangan = .55;
  if ((pegang && pegang.gerak) || keadaan === 'udara') {
    const ayun = pegang ? pegang.ayun : Math.max(-25, Math.min(25, -vx / 40));
    const fr = Math.abs(ayun) > 6 || Math.sin(t / 220) > .6 ? 'angkat_2' : 'angkat_1';
    atas = gambar(fr, x, lantaiY - META.angkat_1.h * s * .92, { rot: ayun, flip: ayun > 0 ? -1 : 1 });
    opBayangan = Math.max(.08, .5 - y / 400);
  } else if (keadaan === 'jalan') {
    atas = gambar('jalan_' + (1 + Math.floor(t / 110) % 5), x, lantaiY);
  } else if (keadaan === 'senang') {
    const fr = umur < 130 ? 'senang_1' : umur < 380 ? 'senang_2' : 'senang_3';
    const lompat = fr === 'senang_2' ? Math.sin(Math.min(1, (umur - 130) / 250) * Math.PI) * 18 * s / .46 : 0;
    atas = gambar(fr, x, lantaiY - lompat); opBayangan = .35;
  } else if (keadaan === 'dielus') {
    atas = gambar('senang_3', x, lantaiY, { rot: Math.sin(t / 260) * 3.5 });
  } else if (keadaan === 'tidur') {
    const n = Math.sin(t / 1000 * 2 * Math.PI / 3.6);
    atas = gambar('tidur_1', x, lantaiY, { sx: 1 + .012 * n, sy: 1 - .022 * n }); lebarBayangan *= 1.5;
  } else if (keadaan === 'ngantuk') {
    atas = gambar(Math.sin(t / 400) > -.3 ? 'kedip_2' : 'kedip_3', x, lantaiY, { sy: 1 - .02 * napas });
  } else if (keadaan === 'menguap') {
    const p = Math.sin(Math.min(1, umur / 1100) * Math.PI);
    atas = gambar('kedip_3', x, lantaiY, { sy: 1 + .08 * p, sx: 1 - .03 * p });
  } else if (keadaan === 'pusing') {
    atas = gambar('kedip_3', x, lantaiY, { rot: Math.sin(t / 120) * 7 * Math.max(0, 1 - umur / 1700), sx: 1 + remas * .2, sy: 1 - remas * .2 });
  } else if (keadaan === 'putar') {
    const p = Math.min(1, umur / 700);
    atas = gambar('senang_2', x, lantaiY - Math.sin(p * Math.PI) * 40 * s / .46, { rot: p * 360 });
  } else if (keadaan === 'mendarat') {
    atas = gambar('kedip_1', x, lantaiY, { sx: 1 + remas * .22, sy: 1 - remas * .22 });
  } else {
    atas = gambar(mata, x, lantaiY, { sx: 1 + .012 * napas, sy: 1 - .016 * napas });
  }

  bayangan.style.width = lebarBayangan + 'px'; bayangan.style.left = (x - lebarBayangan / 2) + 'px';
  bayangan.style.top = (LANTAI - 5) + 'px'; bayangan.style.opacity = opBayangan;
  aksesori.style.left = x + 'px'; aksesori.style.top = (atas + 6) + 'px'; aksesori.style.fontSize = (TINGGI * .3) + 'px';
  if (!gelembung.hidden) {
    gelembung.style.left = Math.max(130, Math.min(W - 130, x)) + 'px';
    gelembung.style.top = Math.max(4, atas - gelembung.offsetHeight - (aksesori.textContent ? TINGGI * .3 + 14 : 12)) + 'px';
  }
  if (keadaan === 'tidur' && t - tZ > 1600) { tZ = t; partikel('z', 1, 'zzz', .55); }
  if (keadaan === 'dielus' && t - tHati > 420) { tHati = t; partikel(pilih(['💖', '💜', '💕']), 1); }
}

// ---------- mouse ----------
// Jendela tembus klik; saat kursor di atas gambar kucing, jendela menangkap mouse agar kucing bisa diklik/diangkat.
let tangkap = false;
function setTangkap(v) { if (v !== tangkap) { tangkap = v; window.api.petTangkap(v); } }
img.addEventListener('mouseenter', () => setTangkap(true));
img.addEventListener('mouseleave', () => { if (!pegang) setTangkap(false); });

const elus = { arah: 0, balik: [] };
window.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  if (pegang) return;
  // elus: gosok kursor bolak-balik di bagian kepala (separuh atas gambar)
  const r = img.getBoundingClientRect();
  const diKepala = e.clientX > r.left + r.width * .12 && e.clientX < r.right - r.width * .12 && e.clientY > r.top && e.clientY < r.top + r.height * .5;
  if (diKepala && ['diam', 'senang', 'dielus'].includes(keadaan)) {
    const ar = Math.sign(e.movementX);
    if (ar && ar !== elus.arah) { elus.balik.push(performance.now()); elus.arah = ar; }
    elus.balik = elus.balik.filter(b => performance.now() - b < 1200);
    if (elus.balik.length >= 4) {
      if (keadaan !== 'dielus') bicara(pilih(['Purrr~ 😻', 'Enaaak… 😽', 'Lagi, lagi~ 💕']), 2500);
      setKeadaan('dielus', 1300); disentuh = Date.now();
    }
  }
});
img.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  e.preventDefault(); try { img.setPointerCapture(e.pointerId); } catch { /* lanjut */ }
  pegang = { x0: e.clientX, y0: e.clientY, jejak: [], gerak: false, ayun: 0 };
  disentuh = Date.now();
});
window.addEventListener('pointermove', e => {
  if (!pegang) return;
  if (!pegang.gerak && Math.hypot(e.clientX - pegang.x0, e.clientY - pegang.y0) > 6) {
    pegang.gerak = true; document.body.classList.add('pegang'); setKeadaan('diangkat');
    bicara(pilih(['Waaa! 😳', 'Turunkan aku~ 🥺', 'Terbaaang! ✈️', 'Eh, eh, eh! 😲']), 2000);
  }
  if (!pegang.gerak) return;
  const gantung = META.angkat_1.h * k() * .92;
  x = Math.max(40, Math.min(W - 40, e.clientX));
  y = Math.max(0, Math.min(LANTAI - gantung * .3, LANTAI - (e.clientY - 6) - gantung));
  pegang.jejak.push({ t: performance.now(), x: e.clientX, y: e.clientY }); if (pegang.jejak.length > 6) pegang.jejak.shift();
  const j = pegang.jejak; pegang.ayun = Math.max(-30, Math.min(30, (j[j.length - 1].x - j[0].x) * -.6));
});
function lepas(e) {
  if (!pegang) return;
  const p = pegang; pegang = null; document.body.classList.remove('pegang');
  if (p.gerak) {
    const j = p.jejak, a = j[0], b = j[j.length - 1], dt = a && b ? Math.max(.016, (b.t - a.t) / 1000) : 1;
    vx = a && b ? Math.max(-1500, Math.min(1500, (b.x - a.x) / dt)) : 0;
    vy = a && b ? Math.max(-900, Math.min(1500, -(b.y - a.y) / dt)) : 0;
    setKeadaan('udara');
  } else klik();
  const r = img.getBoundingClientRect();
  if (!(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)) setTangkap(false);
}
window.addEventListener('pointerup', lepas);
window.addEventListener('pointercancel', lepas);
window.addEventListener('blur', () => { if (pegang) lepas({ clientX: -1, clientY: -1 }); });

// klik sekali = senang; dua kali cepat = berputar
let tKlik = null;
function klik() {
  disentuh = Date.now();
  if (tKlik) { clearTimeout(tKlik); tKlik = null; setKeadaan('putar', 700); partikel('✨', 5); bicara('Wiiii! 🌀', 1500); return; }
  tKlik = setTimeout(() => {
    tKlik = null;
    if (keadaan === 'tidur' || keadaan === 'ngantuk') { setKeadaan('menguap', 1100); bicara(pilih(['Hoaam… sudah pagi? 😪', 'Eh, aku ketiduran 😅', 'Lima menit lagi… 😴']), 3000); return; }
    setKeadaan('senang'); partikel(pilih(['💖', '💜', '🌸']), 4);
    bicara(pilih(['Hai, Bu Guru! 👋', 'Meong~ 😸', 'Semangat mengajar! 💪', 'Aku sayang Ibu! 💖', 'Hehe, geli! 😆', 'Ibu hebat hari ini! 🌟']), 3000);
  }, 240);
}

// ---------- pengingat: pelajaran, sholat, hujan, tugas, ulang tahun, sapaan ----------
const sudah = new Set();
let sapaanBerikut = Date.now() + acak(8, 15) * 60 * 1000, mauHujan = false, adaUlangTahun = false;
function sekali(kunci, fn) { if (!sudah.has(kunci)) { sudah.add(kunci); fn(); } }
function aturAksesori() { aksesori.textContent = keadaan === 'tidur' ? '' : (adaUlangTahun ? '🥳' : (mauHujan ? '☂️' : '')); }
function cekPeristiwa() {
  if (!cfg) return;
  const d = new Date(), hari = B.tglStr(d), n = d.getHours() * 60 + d.getMinutes();
  const data = bkSt && bkSt.masuk && bkSt.data ? bkSt.data : null;
  const info = B.infoHari(hari, data ? data.presensi : null);
  const bangunkan = () => { if (keadaan === 'tidur' || keadaan === 'ngantuk') setKeadaan('menguap', 1100); };
  if (info.sekolah) for (const j of B.jadwalHari(cfg, d)) {
    if (Math.floor(j.s) !== n) continue;
    sekali(`${hari}|j${j.s}`, () => {
      bangunkan();
      if (j.pelajaran) { bicara(`Waktunya ${j.mapel}! 📚`, 7000); setTimeout(() => setKeadaan('senang'), 1200); }
      else if (/istirahat/i.test(j.mapel)) bicara('Istirahat dulu yuk 🍎', 6000);
    });
  }
  const sh = cfg.sholat || {};
  if (sh.aktif !== false) {
    const w = B.waktuSholat(d, Number(sh.lat) || -0.48, Number(sh.lon) || 102.44, 7);
    for (const [kk, nama] of B.NAMA_SHOLAT) if (Math.floor(w[kk]) === n)
      sekali(`${hari}|s${kk}`, () => { bangunkan(); bicara(`Sudah masuk waktu ${d.getDay() === 5 && kk === 'dzuhur' ? 'Jumat' : nama} 🕌`, 9000); });
  }
  const jamIni = cuaca && Array.isArray(cuaca.jam) ? cuaca.jam.find(h => new Date(h.t).getHours() === d.getHours() && B.tglStr(new Date(h.t)) === hari) : null;
  mauHujan = !!(jamIni && jamIni.hujan >= 50);
  if (mauHujan) sekali(`${hari}|h${Math.floor(d.getHours() / 2)}`, () => bicara(`Sedia payung ya, mau hujan ${jamIni.hujan}% ☔`, 6000));
  if (n >= 7 * 60 && Array.isArray(cfg.tugas)) {
    const jatuh = cfg.tugas.filter(tg => !tg.selesai && tg.tenggat && tg.tenggat <= hari);
    if (jatuh.length) sekali(`${hari}|tugas`, () => bicara(`Ada ${jatuh.length} tugas yang jatuh tempo ✅`, 7000));
  }
  const ultah = (data ? data.siswa || [] : []).filter(sw => sw.lahir && sw.lahir.slice(5) === hari.slice(5));
  adaUlangTahun = ultah.length > 0;
  if (adaUlangTahun && n >= 390) sekali(`${hari}|ultah`, () => { bicara(`Hari ini ${ultah.map(sw => sw.panggilan || sw.nama).join(', ')} ulang tahun! 🎂`, 9000); partikel('🎉', 5); });
  if (Date.now() > sapaanBerikut) {
    sapaanBerikut = Date.now() + acak(12, 25) * 60 * 1000;
    if (n >= 360 && n <= 1200 && keadaan !== 'tidur' && Math.random() < .7)
      bicara(pilih(['Jangan lupa minum air ya 💧', 'Istirahatkan mata sebentar 👀', 'Semangat, Bu Guru! 💪', 'Senyum dulu dong 😊', 'Aku temani Ibu kerja ya 🤗', 'Peregangan sebentar yuk 🙆']));
  }
  aturAksesori();
}

// ---------- mulai ----------
function terapkan(c) { cfg = c; B.setKaldik(c.kaldik); TINGGI = Math.max(70, Math.min(220, Number(opsi().ukuran) || 120)); }
function ukurLayar() { W = innerWidth; LANTAI = innerHeight - 2; x = Math.max(40, Math.min(W - 40, x)); }
window.addEventListener('resize', ukurLayar);
window.api.onConfig(terapkan);
window.api.onCuaca(c => { cuaca = c; });
window.api.bk.onStatus(st => { bkSt = st; });
(async () => {
  terapkan(await window.api.getConfig());
  cuaca = await window.api.cuaca().catch(() => null);
  try { bkSt = await window.api.bk.status(); } catch { bkSt = null; }
  ukurLayar();
  setKeadaan('diam', 3000);
  setTimeout(() => bicara(malam() ? 'Selamat malam, Bu Guru 🌙' : 'Halo, Bu Guru! 👋', 4000), 1200);
  requestAnimationFrame(langkah);
  setInterval(cekPeristiwa, 15 * 1000);
  cekPeristiwa();
})();
