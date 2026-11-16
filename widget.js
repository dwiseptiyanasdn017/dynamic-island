'use strict';
/* Widget desktop — kartu Sholat & Cuaca dan Jadwal pelajaran.
   Memakai perhitungan sholat (Bersama.waktuSholat, kriteria Kemenag) dan data cuaca Open-Meteo yang sama dengan pulau. */
const $ = s => document.querySelector(s);
const B = window.Bersama;
const { pad, fmtMin, esc } = B;

let cfg = null;
let cuaca = null;
let bkSt = null;   // status BukuKelas (untuk libur sekolah & warna mapel)

// ---------- Tema (sama dengan pulau) ----------
function applyTheme() {
  const t = cfg.tampilan, r = document.documentElement.style;
  const tema = t.tema && t.tema !== 'kustom' ? (B.TEMA.find(x => x.id === t.tema) || {}) : {};
  const v = B.varTema({ ...t, latarCss: tema.latarCss || '' });
  for (const [k, val] of Object.entries(v)) r.setProperty(k, val);
  const w = cfg.widget || {};
  r.setProperty('--op', (Number(w.transparansi) || 90) / 100);
  const terang = B.terang(tema.warnaLatar || t.warnaLatar) > 0.4;
  r.setProperty('--hujan', terang ? '#0369a1' : '#7dd3fc');
  document.body.classList.toggle('kunci', !!w.kunci);
}

// ---------- Sholat ----------
function sholatHari(d) {
  const c = cfg.sholat || {};
  const w = B.waktuSholat(d, Number(c.lat) || -0.48, Number(c.lon) || 102.44, 7);
  return B.NAMA_SHOLAT.map(([k, n]) => ({ k, nama: d.getDay() === 5 && k === 'dzuhur' ? 'Jumat' : n, m: w[k] }));
}
function lamaTeks(menit) {
  menit = Math.max(0, Math.ceil(menit));
  const j = Math.floor(menit / 60), m = menit % 60;
  if (j && m) return `${j} j ${m} mnt`;
  return j ? `${j} jam` : `${m} mnt`;
}
function renderSholat(d, n) {
  const box = $('#sh');
  if ((cfg.sholat || {}).aktif === false) { box.hidden = true; return; }
  box.hidden = false;
  const list = sholatHari(d);
  let next = list.find(x => x.m > n), sisa, besok = false;
  if (next) sisa = next.m - n;
  else { next = sholatHari(new Date(d.getTime() + 864e5))[0]; besok = true; sisa = next.m + 1440 - n; }
  // 15 menit setelah masuk waktu, tampilkan "telah masuk" agar tidak terlewat
  const baru = list.filter(x => x.m <= n && n - x.m < 15).pop();
  $('#sh-next').innerHTML = baru
    ? `<span>🕌 Waktu <b>${esc(baru.nama)}</b> telah masuk</span><span class="sisa">${fmtMin(baru.m)}</span>`
    : `<span>🕌 <b>${esc(next.nama)}</b> ${besok ? 'besok ' : ''}${fmtMin(next.m)}</span><span class="sisa">${lamaTeks(sisa)} lagi</span>`;
  $('#sh-list').innerHTML = list.map(x => {
    const kelas = baru ? (x.k === baru.k ? 'next' : (x.m < n ? 'lewat' : ''))
      : (!besok && x.k === next.k ? 'next' : (x.m <= n ? 'lewat' : ''));
    return `<div class="${kelas}">${esc(x.nama)}<b>${fmtMin(x.m)}</b></div>`;
  }).join('');
}

// ---------- Cuaca ----------
function renderCuaca(d) {
  const box = $('#cu'), c = cfg.cuaca || {};
  if (c.aktif === false) { box.hidden = true; return; }
  box.hidden = false;
  if (!cuaca) {
    $('#cu-kini').innerHTML = '<div class="muted kosong">Menunggu data cuaca… (perlu internet)</div>';
    $('#cu-jam').innerHTML = '';
    return;
  }
  const [ik, ket] = B.cuacaKode(cuaca.kode, cuaca.siang);
  const umur = Date.now() - cuaca.waktu;
  const tgl = new Date(cuaca.waktu);
  const catatan = umur > 3600 * 1000
    ? `Data terakhir ${pad(tgl.getHours())}:${pad(tgl.getMinutes())}`
    : `Terasa ${Math.round(cuaca.terasa)}° · lembap ${cuaca.lembap}%`;
  const mulaiJam = new Date(d); mulaiJam.setMinutes(0, 0, 0);
  const jam = (cuaca.jam || []).filter(h => new Date(h.t).getTime() >= mulaiJam.getTime()).slice(0, 6);
  const hujan = jam.find(h => h.hujan >= 50);
  $('#cu-kini').innerHTML = `<span class="ik">${ik}</span><span class="suhu">${Math.round(cuaca.suhu)}°</span>
    <span class="ket"><b>${esc(ket)}</b><br>${hujan
      ? `<span class="hujan">☔ Hujan ${hujan.hujan}% ${new Date(hujan.t).getHours() === d.getHours() ? 'sekarang' : '±' + pad(new Date(hujan.t).getHours()) + ':00'}</span>`
      : `<span class="muted kecil">${esc(catatan)}</span>`}</span>`;
  $('#cu-jam').innerHTML = jam.map((h, i) => {
    const t = new Date(h.t), jj = t.getHours();
    const [e] = B.cuacaKode(h.kode, jj >= 6 && jj < 18);
    return `<div class="j ${h.hujan >= 50 ? 'basah' : ''}"><span class="muted">${i === 0 ? 'Kini' : pad(jj)}</span><span class="e">${e}</span>${h.hujan > 0 ? h.hujan + '%' : '<span class="muted">–</span>'}</div>`;
  }).join('');
}

// ---------- Jadwal pelajaran ----------
const bkData = () => (bkSt && bkSt.masuk && bkSt.data) || null;
const kartuAktif = id => ((cfg.widget || {}).kartu || {})[id] !== false;
function warnaMapel(nama) {
  const d = bkData();
  const m = d ? B.cocokMapel(nama, d.struktur, (cfg.bukukelas || {}).mapelJadwal) : null;
  if (m) return B.PALET_MAPEL[(m.warna || 0) % B.PALET_MAPEL.length];
  let h = 0; for (const c of nama) h = (h * 31 + c.charCodeAt(0)) >>> 0;   // sama dengan pulau
  return B.PALET_MAPEL[h % B.PALET_MAPEL.length];
}
function renderJadwal(d, n) {
  const box = $('#k-jd');
  if (!kartuAktif('jadwal')) { box.hidden = true; return; }
  box.hidden = false;
  const presensi = bkData() ? bkData().presensi : null;
  const infoKini = B.infoHari(B.tglStr(d), presensi);
  let hari = d, list = B.jadwalHari(cfg, d), selisih = 0;
  const sudahSelesai = list.length && n >= list[list.length - 1].e;
  // hari ini libur atau pelajaran sudah selesai -> tampilkan hari sekolah berikutnya
  if (!infoKini.sekolah || !list.length || sudahSelesai) {
    list = [];
    for (let i = 1; i <= 10; i++) {
      const h = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      const l = B.jadwalHari(cfg, h);
      if (l.length && B.infoHari(B.tglStr(h), presensi).sekolah) { hari = h; list = l; selisih = i; break; }
    }
  }
  const hariIni = selisih === 0;
  $('#jd-judul').textContent = hariIni ? '📚 Jadwal hari ini'
    : `📚 Jadwal ${selisih === 1 ? 'besok · ' + B.HARI[hari.getDay()] : B.HARI[hari.getDay()] + ', ' + hari.getDate() + ' ' + B.BULAN[hari.getMonth()]}`;
  const pel = list.filter(x => x.pelajaran);
  const ringkas = list.length ? `${pel.reduce((a, x) => a + x.jp, 0)} JP · ${fmtMin(list[0].s)}–${fmtMin(list[list.length - 1].e)}` : '';
  const alasan = !infoKini.sekolah ? `Hari ini: ${infoKini.alasan}` : (sudahSelesai ? 'Pelajaran hari ini sudah selesai' : 'Hari ini tidak ada jadwal');
  $('#jd-sub').innerHTML = hariIni ? esc(ringkas) : [esc(alasan), esc(ringkas)].filter(Boolean).join('<br>');

  if (!list.length) {
    $('#jd-kini').innerHTML = '';
    $('#jd-list').innerHTML = '<li class="muted jd-kosong">Belum ada jadwal. Isi di Pengaturan → Jadwal Mengajar.</li>';
    return;
  }

  // blok "Sekarang" / "Berikutnya" (hanya untuk hari ini)
  const kini = hariIni ? list.find(x => n >= x.s && n < x.e) : null;
  const next = hariIni ? list.find(x => x.s > n) : null;
  if (kini) {
    const pct = Math.min(100, Math.max(0, (n - kini.s) / (kini.e - kini.s) * 100));
    $('#jd-kini').innerHTML = `<div class="jd-now" style="--warna:${kini.pelajaran ? warnaMapel(kini.mapel) : 'var(--aksen)'}">
      <div class="lbl">Sekarang${kini.pelajaran ? ' · jam ke-' + String(kini.jpKe).replace('-', '–') : ''}</div>
      <div class="mp">${esc(kini.mapel)}${kini.ket ? ` <span class="muted kecil">· ${esc(kini.ket)}</span>` : ''}</div>
      <div class="bar"><div style="width:${pct.toFixed(1)}%"></div></div>
      <div class="ft"><span class="muted">${fmtMin(kini.s)}–${fmtMin(kini.e)}</span><span>sisa ${lamaTeks(kini.e - n)}${next ? ' · lalu ' + esc(next.mapel) : ''}</span></div></div>`;
  } else if (next) {
    $('#jd-kini').innerHTML = `<div class="jd-now" style="--warna:${next.pelajaran ? warnaMapel(next.mapel) : 'var(--aksen)'}">
      <div class="lbl">Berikutnya</div>
      <div class="mp">${esc(next.mapel)}${next.ket ? ` <span class="muted kecil">· ${esc(next.ket)}</span>` : ''}</div>
      <div class="ft"><span class="muted">mulai ${fmtMin(next.s)}</span><span>${lamaTeks(next.s - n)} lagi</span></div></div>`;
  } else $('#jd-kini').innerHTML = '';

  $('#jd-list').innerHTML = list.map(x => {
    const kelas = [x.pelajaran ? '' : 'rehat',
      hariIni && n >= x.e ? 'lewat' : '', x === kini ? 'kini' : '', !kini && x === next ? 'next' : ''].filter(Boolean).join(' ');
    return `<li class="${kelas}"><span class="jam">${fmtMin(x.s)}–${fmtMin(x.e)}</span>
      <span class="mp">${x.pelajaran ? `<i class="dot" style="background:${warnaMapel(x.mapel)}"></i>` : '<i class="dot"></i>'}<span>${esc(x.mapel)}</span></span>
      <span class="jp">${x.pelajaran ? x.jp + ' JP' : ''}</span></li>`;
  }).join('');
}

// ---------- Render ----------
function render() {
  if (!cfg) return;
  const d = new Date(), n = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  $('#sc-tgl').textContent = `${B.HARI[d.getDay()]}, ${d.getDate()} ${B.BULAN[d.getMonth()]}`;
  $('#sc-lok').textContent = '📍 ' + (((cfg.cuaca || {}).nama || '').trim() || 'Lokasi belum diatur');
  $('#sc-segar').hidden = (cfg.cuaca || {}).aktif === false;
  renderCuaca(d);
  renderSholat(d, n);
  const semuaMati = (cfg.sholat || {}).aktif === false && (cfg.cuaca || {}).aktif === false;
  $('#k-sc').hidden = semuaMati || !kartuAktif('sholatCuaca');
  renderJadwal(d, n);
}

// Ukuran jendela mengikuti isi kartu
new ResizeObserver(() => window.api.widgetTinggi(document.getElementById('tumpuk').offsetHeight))
  .observe(document.getElementById('tumpuk'));

$('#sc-segar').addEventListener('click', () => {
  const b = $('#sc-segar');
  b.classList.add('putar');
  window.api.segarkanCuaca();
  setTimeout(() => b.classList.remove('putar'), 4000);
});

window.api.onConfig(c => { cfg = c; applyTheme(); render(); });
window.api.bk.onStatus(st => { bkSt = st; render(); });
window.api.onCuaca(c => { cuaca = c; $('#sc-segar').classList.remove('putar'); render(); });

(async () => {
  cfg = await window.api.getConfig();
  cuaca = await window.api.cuaca();
  try { bkSt = await window.api.bk.status(); } catch { bkSt = null; }
  applyTheme();
  render();
  // perbarui tiap 20 detik (hitung mundur, bilah pelajaran, pergantian hari)
  setInterval(render, 20 * 1000);
})();
