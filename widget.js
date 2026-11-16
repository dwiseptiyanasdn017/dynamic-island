'use strict';
/* Widget desktop — kartu Sholat & Cuaca, Jadwal, Kalender, Kelas hari ini, Tugas, Catatan, Ulang tahun.
   Memakai perhitungan sholat (Bersama.waktuSholat, kriteria Kemenag) dan data cuaca Open-Meteo yang sama dengan pulau. */
const $ = s => document.querySelector(s);
const B = window.Bersama;
const { pad, fmtMin, esc } = B;

let cfg = null;
// Setiap jendela widget hanya menampilkan satu kartu: ?kartu=sholatCuaca | jadwal | kalender
const KARTU_INI = new URLSearchParams(location.search).get('kartu') || 'sholatCuaca';
const ID_KARTU = { sholatCuaca: 'k-sc', jadwal: 'k-jd', kalender: 'k-kal', kelasHariIni: 'k-kh', tugas: 'k-tg', catatan: 'k-ct', ulangTahun: 'k-ut' };
let cuaca = null;
let bkSt = null;   // status BukuKelas (untuk libur sekolah & warna mapel)

// ---------- Tema (sama dengan pulau) ----------
function applyTheme() {
  B.setKaldik(cfg.kaldik);
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
const kartuAktif = id => id === KARTU_INI;
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
    for (let i = 1; i <= 45; i++) {   // cukup untuk libur semester / libur Idul Fitri
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

// ---------- Kalender ----------
let kalBulan = null, kalPilih = null;
const BLN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function rentangTeks(a, b) {
  const x = B.keDate(a), y = B.keDate(b || a);
  if (a === (b || a)) return `${B.HARI[x.getDay()]}, ${x.getDate()} ${BLN3[x.getMonth()]}`;
  return x.getMonth() === y.getMonth() ? `${x.getDate()}–${y.getDate()} ${BLN3[y.getMonth()]}` : `${x.getDate()} ${BLN3[x.getMonth()]} – ${y.getDate()} ${BLN3[y.getMonth()]}`;
}
/** Semua penanda pada satu tanggal: libur sekolah BukuKelas, kalender pendidikan, libur nasional. */
function tandaTanggal(ts, presensi) {
  const out = [];
  ((presensi && presensi.libur) || []).filter(l => ts >= l.tgl && ts <= (l.sampai || l.tgl))
    .forEach(l => out.push({ nama: l.ket || 'Libur sekolah', jenis: 'libur', mulai: l.tgl, sampai: l.sampai || l.tgl }));
  B.kaldikTanggal(ts).forEach(x => out.push(x));
  if (B.liburNasional(ts)) out.push({ nama: B.liburNasional(ts), jenis: 'libur', mulai: ts, sampai: ts, nasional: true });
  return out;
}
/** Agenda terdekat mulai hari ini (yang sedang berlangsung ikut dihitung). */
function agendaTerdekat(d, presensi, jumlah) {
  const hari = B.tglStr(d), batas = B.tglStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 180));
  const semua = [
    ...B.getKaldik(),
    ...((presensi && presensi.libur) || []).map(l => ({ nama: l.ket || 'Libur sekolah', jenis: 'libur', mulai: l.tgl, sampai: l.sampai || l.tgl })),
    ...Object.keys(B.LIBUR_NASIONAL).filter(t => B.liburNasional(t)).map(t => ({ nama: B.liburNasional(t), jenis: 'libur', mulai: t, sampai: t }))
  ].filter(x => x.sampai >= hari && x.mulai <= batas);
  // gabungkan libur nasional yang berurutan dan bernama sama (mis. Idulfitri 2 hari)
  semua.sort((a, b) => a.mulai.localeCompare(b.mulai) || a.nama.localeCompare(b.nama));
  const hasil = [];
  for (const x of semua) {
    const p = hasil[hasil.length - 1];
    const besokP = p && B.tglStr(new Date(B.keDate(p.sampai).getTime() + 864e5));
    if (p && p.nama === x.nama && x.mulai <= besokP) { if (x.sampai > p.sampai) p.sampai = x.sampai; continue; }
    if (hasil.some(h => h.nama === x.nama && h.mulai === x.mulai)) continue;
    hasil.push({ ...x });
  }
  return hasil.slice(0, jumlah);
}
function sisaHari(x, d) {
  const hari = B.tglStr(d);
  if (x.mulai <= hari) return x.sampai > hari ? 'berlangsung' : 'hari ini';
  const n = Math.round((B.keDate(x.mulai) - B.keDate(hari)) / 864e5);
  return n === 1 ? 'besok' : `${n} hari lagi`;
}
function renderKalender(d) {
  const box = $('#k-kal');
  if (!kartuAktif('kalender')) { box.hidden = true; return; }
  box.hidden = false;
  const bulan = kalBulan || new Date(d.getFullYear(), d.getMonth(), 1);   // null = ikut bulan berjalan
  const th = bulan.getFullYear(), bl = bulan.getMonth();
  const presensi = bkData() ? bkData().presensi : null;
  const hariIni = B.tglStr(d);
  $('#kal-judul').textContent = `🗓️ ${B.BULAN[bl]} ${th}`;
  const awal = new Date(th, bl, 1); awal.setDate(1 - ((awal.getDay() + 6) % 7));   // Senin awal minggu
  const minggu = Math.ceil((((new Date(th, bl, 1).getDay() + 6) % 7) + new Date(th, bl + 1, 0).getDate()) / 7);
  let html = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((h, i) => `<span class="hd${i === 6 ? ' mg' : ''}">${h}</span>`).join('');
  for (let i = 0; i < minggu * 7; i++) {
    const t = new Date(awal); t.setDate(awal.getDate() + i);
    const ts = B.tglStr(t), info = B.infoHari(ts, presensi);
    const tanda = tandaTanggal(ts, presensi);
    const ag = tanda.find(x => x.jenis !== 'libur');
    const blok = tanda.some(x => x.jenis === 'libur' && !x.nasional);   // libur sekolah / libur semester
    const cls = [t.getMonth() !== bl ? 'luar' : '', !info.sekolah ? 'libur' : '', blok ? 'blok' : '', ag ? 'ag' : '',
      ts === hariIni ? 'ini' : '', ts === kalPilih ? 'pilih' : ''].filter(Boolean).join(' ');
    const judul = [info.alasan, ...tanda.filter(x => x.jenis !== 'libur').map(x => x.nama)].filter(Boolean).join(' · ');
    html += `<button class="${cls}" data-t="${ts}" title="${esc(judul)}"${ag ? ` style="--ag:${B.JENIS_KALDIK[ag.jenis][1]}"` : ''}>${t.getDate()}</button>`;
  }
  $('#kal-grid').innerHTML = html;

  const baris = (x, kanan) => `<li><i class="dot" style="background:${B.JENIS_KALDIK[x.jenis][1]}"></i>
    <span>${esc(x.nama)}<span class="tg">${rentangTeks(x.mulai, x.sampai)}</span></span><span class="ss">${kanan}</span></li>`;
  if (kalPilih) {
    const info = B.infoHari(kalPilih, presensi);
    const tanda = tandaTanggal(kalPilih, presensi);
    $('#kal-info').innerHTML = `<div class="lbl">${esc(B.tglPanjang(kalPilih))}</div>` + (tanda.length
      ? `<ul>${tanda.map(x => baris(x, '')).join('')}</ul>`
      : `<div class="kosong">${info.sekolah ? 'Hari sekolah biasa' : esc(info.alasan)}</div>`);
  } else {
    const list = agendaTerdekat(d, presensi, 3);
    $('#kal-info').innerHTML = '<div class="lbl">Agenda terdekat</div>' + (list.length
      ? `<ul>${list.map(x => baris(x, sisaHari(x, d))).join('')}</ul>`
      : '<div class="kosong">Belum ada agenda. Isi di Pengaturan → Kalender Pendidikan.</div>');
  }
}
$('#kal-grid').addEventListener('click', e => {
  const b = e.target.closest('button[data-t]'); if (!b) return;
  kalPilih = kalPilih === b.dataset.t ? null : b.dataset.t;
  render();
});
function geserBulan(n) {
  const d = new Date(), b = kalBulan || new Date(d.getFullYear(), d.getMonth(), 1);
  kalBulan = new Date(b.getFullYear(), b.getMonth() + n, 1);
  if (kalBulan.getFullYear() === d.getFullYear() && kalBulan.getMonth() === d.getMonth()) kalBulan = null;
  kalPilih = null; render();
}
$('#kal-prev').addEventListener('click', () => geserBulan(-1));
$('#kal-next').addEventListener('click', () => geserBulan(1));
$('#kal-ini').addEventListener('click', () => { kalBulan = null; kalPilih = null; render(); });

// ---------- Kelas hari ini: presensi + status jurnal ----------
let khData = { tgl: '', absen: null, jurnal: null, waktu: 0, galat: '' };
async function muatKelasHariIni(paksa) {
  const t = B.tglStr(new Date());
  if (!bkData() || (!paksa && khData.tgl === t && Date.now() - khData.waktu < 2 * 60 * 1000)) return;
  khData.waktu = Date.now();
  try {
    const [absen, jurnal] = await Promise.all([window.api.bk.absen(t), window.api.bk.jurnal(t)]);
    const ambil = r => { if (r && typeof r === 'object' && 'ok' in r) { if (!r.ok) throw new Error(r.galat || 'gagal'); return r.hasil; } return r; };
    khData = { tgl: t, absen: ambil(absen) || {}, jurnal: ambil(jurnal) || [], waktu: Date.now(), galat: '' };
  } catch (e) { khData.galat = String(e.message || e); }
  render();
}
function renderKelasHariIni(d) {
  const box = $('#k-kh');
  if (!kartuAktif('kelasHariIni')) { box.hidden = true; return; }
  box.hidden = false;
  const data = bkData();
  $('#kh-kelas').textContent = data && data.kelas ? data.kelas : '';
  const t = B.tglStr(d), info = B.infoHari(t, data ? data.presensi : null);
  $('#kh-sub').textContent = `${B.HARI[d.getDay()]}, ${d.getDate()} ${B.BULAN[d.getMonth()]}` + (info.sekolah ? '' : ` · Libur: ${info.alasan}`);
  if (!data) {
    $('#kh-isi').innerHTML = `<div class="kosong-kecil">${bkSt && bkSt.siapKonfig === false ? 'BukuKelas belum disambungkan.' : 'Masuk ke BukuKelas di Panel Kelas untuk melihat presensi dan jurnal.'}</div>
      <div class="kh-aksi"><button class="tombol utama" data-buka="presensi">Buka Panel Kelas</button></div>`;
    return;
  }
  if (khData.tgl !== t) { muatKelasHariIni(); }
  const siswa = data.siswa || [];
  const absen = khData.tgl === t && khData.absen ? khData.absen : (data.tgl === t ? data.absen || {} : {});
  const hit = { 1: [], 2: [], 3: [] };
  siswa.forEach(sw => { const v = absen[sw.id]; if (hit[v]) hit[v].push(sw); });
  const tdk = hit[1].length + hit[2].length + hit[3].length;
  let html = `<div class="kh-rekap">
    <div class="h"><b>${info.sekolah ? siswa.length - tdk : '–'}</b><span>Hadir</span></div>
    <div class="s"><b>${hit[1].length}</b><span>Sakit</span></div>
    <div class="i"><b>${hit[2].length}</b><span>Izin</span></div>
    <div class="a"><b>${hit[3].length}</b><span>Alpa</span></div></div>`;
  if (tdk) html += `<div class="kh-absen">${[[1, 's', 'S'], [2, 'i', 'I'], [3, 'a', 'A']].map(([k, c, l]) =>
      hit[k].map(sw => `<span style="white-space:nowrap"><span class="tag ${c}">${l}</span>${esc(sw.panggilan || sw.nama)}</span>`).join(' &nbsp;')).filter(Boolean).join(' &nbsp;')}</div>`;
  else if (info.sekolah) html += `<div class="kh-absen muted">Semua ${siswa.length} siswa tercatat hadir.</div>`;

  // status jurnal: tiap pelajaran hari ini dicocokkan dengan jurnal yang sudah ditulis
  const pel = info.sekolah ? B.jadwalHari(cfg, d).filter(x => x.pelajaran) : [];
  if (pel.length) {
    const jurnal = khData.tgl === t && khData.jurnal ? khData.jurnal : [];
    const n = d.getHours() * 60 + d.getMinutes();
    const terisi = new Set(jurnal.map(j => j.mapel));
    const baris = pel.map(x => {
      const m = B.cocokMapel(x.mapel, data.struktur, (cfg.bukukelas || {}).mapelJadwal);
      const ok = m && terisi.has(m.id);
      const blmMulai = n < x.s;
      return `<div class="baris"><span class="${ok ? 'ok' : 'blm'}">${ok ? '✓' : '○'}</span><span>${esc(x.mapel)}</span>
        ${ok ? '<span class="muted kecil">terisi</span>' : (blmMulai ? `<span class="muted kecil">${fmtMin(x.s)}</span>` : `<button class="tautan" style="padding:0" data-buka="jurnal" data-mapel="${m ? esc(m.id) : ''}">Isi</button>`)}</div>`;
    });
    const jumlahOk = pel.filter(x => { const m = B.cocokMapel(x.mapel, data.struktur, (cfg.bukukelas || {}).mapelJadwal); return m && terisi.has(m.id); }).length;
    html += `<div class="kh-jurnal"><div class="muted kecil" style="margin-bottom:3px">JURNAL MENGAJAR · ${jumlahOk}/${pel.length} terisi</div>${baris.join('')}</div>`;
  }
  if (khData.galat) html += `<div class="kosong-kecil" style="color:#dc2626">Gagal memuat: ${esc(khData.galat)}</div>`;
  html += `<div class="kh-aksi"><button class="tombol" data-buka="presensi">Presensi</button><button class="tombol" data-buka="jurnal">Jurnal</button></div>`;
  $('#kh-isi').innerHTML = html;
}
$('#kh-isi').addEventListener('click', e => {
  const b = e.target.closest('[data-buka]'); if (!b) return;
  const arg = { tab: b.dataset.buka };
  if (arg.tab === 'jurnal') { arg.tgl = B.tglStr(new Date()); if (b.dataset.mapel) arg.mapel = b.dataset.mapel; }
  window.api.openKelas(arg);
});
$('#kh-segar').addEventListener('click', () => { muatKelasHariIni(true); window.api.bk.muat(); });

// ---------- Daftar tugas ----------
let tugasBukaSelesai = false;
const tugasList = () => Array.isArray(cfg.tugas) ? cfg.tugas : [];
function simpanTugas(list) { cfg.tugas = list; window.api.simpanTugas(list); render(); }
function tenggatTeks(t, hariIni) {
  if (!t) return ['', ''];
  const n = Math.round((B.keDate(t) - B.keDate(hariIni)) / 864e5);
  if (n < 0) return [`lewat ${-n} hr`, 'lewat'];
  if (n === 0) return ['hari ini', 'hari'];
  if (n === 1) return ['besok', ''];
  const x = B.keDate(t);
  return [n < 7 ? B.HARI[x.getDay()] : `${x.getDate()} ${BLN3[x.getMonth()]}`, ''];
}
function renderTugas(d) {
  const box = $('#k-tg');
  if (!kartuAktif('tugas')) { box.hidden = true; return; }
  box.hidden = false;
  const hariIni = B.tglStr(d);
  const semua = tugasList();
  const aktif = semua.filter(x => !x.selesai).sort((a, b) => (a.tenggat || '9999').localeCompare(b.tenggat || '9999') || a.waktu - b.waktu);
  const selesai = semua.filter(x => x.selesai).sort((a, b) => b.waktu - a.waktu);
  const lewat = aktif.filter(x => x.tenggat && x.tenggat < hariIni).length, hari = aktif.filter(x => x.tenggat === hariIni).length;
  $('#tg-sub').textContent = aktif.length ? [`${aktif.length} belum selesai`, lewat ? `${lewat} lewat tenggat` : '', hari ? `${hari} hari ini` : ''].filter(Boolean).join(' · ')
    : (selesai.length ? 'Semua tugas selesai 🎉' : '');
  const baris = x => {
    const [tt, kls] = tenggatTeks(x.tenggat, hariIni);
    return `<li data-id="${esc(x.id)}"><input type="checkbox" ${x.selesai ? 'checked' : ''}><span class="tg-teks">${esc(x.teks)}</span>
      <span class="tg-tgl ${x.selesai ? '' : kls}">${x.selesai ? '' : tt}</span><button class="tg-hapus" title="Hapus">✕</button></li>`;
  };
  // jangan ganggu bila sedang mengetik di kartu
  $('#tg-list').innerHTML = aktif.length ? aktif.map(baris).join('') : '<li class="kosong-kecil" style="display:block">Belum ada tugas.</li>';
  const tb = $('#tg-selesai-tgl');
  tb.hidden = !selesai.length;
  tb.textContent = `${tugasBukaSelesai ? '▾' : '▸'} Selesai (${selesai.length})`;
  $('#tg-done').hidden = !tugasBukaSelesai || !selesai.length;
  $('#tg-done').innerHTML = selesai.slice(0, 30).map(baris).join('') + (selesai.length ? '<li style="display:block;opacity:1"><button class="tautan" id="tg-bersih">Hapus semua yang selesai</button></li>' : '');
}
$('#tg-form').addEventListener('submit', e => {
  e.preventDefault();
  const teks = $('#tg-teks').value.trim(); if (!teks) return;
  simpanTugas([...tugasList(), { id: Date.now().toString(36), teks, tenggat: $('#tg-tgl').value, selesai: false, waktu: Date.now() }]);
  $('#tg-teks').value = ''; $('#tg-tgl').value = '';
});
$('#tg-tgl').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#tg-form').requestSubmit(); } });
$('#k-tg').addEventListener('click', e => {
  if (e.target.id === 'tg-selesai-tgl') { tugasBukaSelesai = !tugasBukaSelesai; render(); return; }
  if (e.target.id === 'tg-bersih') { simpanTugas(tugasList().filter(x => !x.selesai)); return; }
  const li = e.target.closest('li[data-id]'); if (!li) return;
  const id = li.dataset.id;
  if (e.target.classList.contains('tg-hapus')) simpanTugas(tugasList().filter(x => x.id !== id));
  else if (e.target.type === 'checkbox') simpanTugas(tugasList().map(x => x.id === id ? { ...x, selesai: e.target.checked, waktu: Date.now() } : x));
});

// ---------- Catatan cepat ----------
let tCatatan = null;
function renderCatatan() {
  const box = $('#k-ct');
  if (!kartuAktif('catatan')) { box.hidden = true; return; }
  box.hidden = false;
  const ta = $('#ct-teks');
  if (document.activeElement !== ta && ta.value !== (cfg.catatan || '')) ta.value = cfg.catatan || '';
}
$('#ct-teks').addEventListener('input', () => {
  $('#ct-status').textContent = 'menyimpan…';
  clearTimeout(tCatatan);
  tCatatan = setTimeout(() => { cfg.catatan = $('#ct-teks').value; window.api.simpanCatatan(cfg.catatan); $('#ct-status').textContent = 'tersimpan'; setTimeout(() => { $('#ct-status').textContent = ''; }, 1500); }, 500);
});

// ---------- Ulang tahun siswa ----------
function renderUlangTahun(d) {
  const box = $('#k-ut');
  if (!kartuAktif('ulangTahun')) { box.hidden = true; return; }
  box.hidden = false;
  const data = bkData();
  if (!data) { $('#ut-sub').textContent = ''; $('#ut-list').innerHTML = '<li class="kosong-kecil" style="display:block">Masuk ke BukuKelas di Panel Kelas untuk melihat ulang tahun siswa.</li>'; return; }
  const ada = (data.siswa || []).filter(x => x.lahir);
  if (!ada.length) { $('#ut-sub').textContent = ''; $('#ut-list').innerHTML = '<li class="kosong-kecil" style="display:block">Tanggal lahir siswa belum diisi. Isi di BukuKelas → Data Siswa (biodata).</li>'; return; }
  const h0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daftar = ada.map(x => {
    const [y, m, dd] = x.lahir.split('-').map(Number);
    let ul = new Date(d.getFullYear(), m - 1, dd);
    if (ul < h0) ul = new Date(d.getFullYear() + 1, m - 1, dd);
    return { x, ul, sisa: Math.round((ul - h0) / 864e5), umur: ul.getFullYear() - y };
  }).sort((a, b) => a.sisa - b.sisa);
  const dekat = daftar.filter(u => u.sisa <= 7);
  const tampil = dekat.length ? dekat : daftar.slice(0, 1);
  $('#ut-sub').textContent = dekat.length ? 'Dalam 7 hari ke depan' : 'Berikutnya';
  $('#ut-list').innerHTML = tampil.map(u => `<li class="${u.sisa === 0 ? 'hari' : ''}"><span>${u.sisa === 0 ? '🎉 ' : ''}${esc(u.x.lengkap || u.x.nama)} <span class="muted kecil">· ${u.umur} th</span></span>
    <span class="ut-tgl">${u.sisa === 0 ? 'hari ini' : u.sisa === 1 ? 'besok' : `${B.HARI[u.ul.getDay()]}, ${u.ul.getDate()} ${BLN3[u.ul.getMonth()]}`}</span></li>`).join('')
    + `<li class="kosong-kecil" style="display:block">${ada.length} dari ${(data.siswa || []).length} siswa punya tanggal lahir</li>`;
}

// ---------- Render ----------
function render() {
  if (!cfg) return;
  const d = new Date(), n = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  $('#sc-tgl').textContent = `${B.HARI[d.getDay()]}, ${d.getDate()} ${B.BULAN[d.getMonth()]}`;
  $('#sc-lok').textContent = '📍 ' + (((cfg.cuaca || {}).nama || '').trim() || 'Lokasi belum diatur');
  $('#sc-segar').hidden = (cfg.cuaca || {}).aktif === false;
  if (kartuAktif('sholatCuaca')) {
    renderCuaca(d);
    renderSholat(d, n);
    const semuaMati = (cfg.sholat || {}).aktif === false && (cfg.cuaca || {}).aktif === false;
    $('#cu').hidden = (cfg.cuaca || {}).aktif === false;
    if (semuaMati) $('#cu-kini').innerHTML = '';
    $('#k-sc').hidden = false;
    if (semuaMati) { $('#cu').hidden = false; $('#cu-kini').innerHTML = '<div class="muted kosong">Cuaca dan jadwal sholat dimatikan di Pengaturan.</div>'; $('#cu-jam').innerHTML = ''; }
  } else $('#k-sc').hidden = true;
  renderJadwal(d, n);
  renderKalender(d);
  renderKelasHariIni(d);
  renderTugas(d);
  renderCatatan();
  renderUlangTahun(d);
}

// Ukuran jendela mengikuti isi kartu
// ---------- Ukuran & skala ----------
// Isi kartu diperbesar/diperkecil secara proporsional dengan CSS zoom (70–160%).
const tumpuk = document.getElementById('tumpuk');
const kartuEl = document.getElementById(ID_KARTU[KARTU_INI]);
let skala = 1;
const batasSkala = v => Math.min(1.6, Math.max(0.7, Math.round(v * 100) / 100));
function laporUkuran() {
  const r = tumpuk.getBoundingClientRect();
  window.api.widgetUkuran(Math.ceil(r.width), Math.ceil(r.height));
}
function pasangSkala(v, simpan) {
  skala = batasSkala(v);
  tumpuk.style.zoom = skala;
  $('#skala-lbl').textContent = Math.round(skala * 100) + '%';
  laporUkuran();
  if (simpan) window.api.widgetSkala(skala);
}
new ResizeObserver(laporUkuran).observe(kartuEl);

// Pegangan pojok kanan bawah: seret untuk mengubah ukuran, klik dua kali untuk kembali ke 100%.
const pegangan = document.createElement('div');
pegangan.className = 'pegangan'; pegangan.title = 'Seret untuk mengubah ukuran · klik dua kali: 100%';
kartuEl.appendChild(pegangan);
const lbl = document.createElement('div'); lbl.id = 'skala-lbl'; kartuEl.appendChild(lbl);
let tarik = null;
pegangan.addEventListener('pointerdown', e => {
  if (document.body.classList.contains('kunci')) return;
  e.preventDefault();
  try { pegangan.setPointerCapture(e.pointerId); } catch { /* tetap jalan tanpa capture */ }
  const r = kartuEl.getBoundingClientRect();
  tarik = { x: e.screenX, y: e.screenY, w: r.width, h: r.height, s: skala };
  document.body.classList.add('ubah');
});
pegangan.addEventListener('pointermove', e => {
  if (!tarik) return;
  // ambil perubahan terbesar dari arah mendatar atau tegak, relatif terhadap ukuran awal
  const fx = (tarik.w + e.screenX - tarik.x) / tarik.w, fy = (tarik.h + e.screenY - tarik.y) / tarik.h;
  pasangSkala(tarik.s * (Math.abs(fx - 1) > Math.abs(fy - 1) ? fx : fy), false);
});
const selesaiTarik = () => { if (!tarik) return; tarik = null; document.body.classList.remove('ubah'); window.api.widgetSkala(skala); };
pegangan.addEventListener('pointerup', selesaiTarik);
pegangan.addEventListener('pointercancel', selesaiTarik);
pegangan.addEventListener('dblclick', () => pasangSkala(1, true));
// Ctrl + scroll di atas kartu
let tWheel = null;
window.addEventListener('wheel', e => {
  if (!e.ctrlKey || document.body.classList.contains('kunci')) return;
  e.preventDefault();
  pasangSkala(skala + (e.deltaY < 0 ? 0.05 : -0.05), false);
  document.body.classList.add('ubah');
  clearTimeout(tWheel);
  tWheel = setTimeout(() => { document.body.classList.remove('ubah'); window.api.widgetSkala(skala); }, 600);
}, { passive: false });
function skalaDariConfig() {
  const v = Number((((cfg.widget || {}).kartuPos || {})[KARTU_INI] || {}).skala) || 1;
  if (!tarik && Math.abs(v - skala) > 0.001) pasangSkala(v, false);
}

$('#sc-segar').addEventListener('click', () => {
  const b = $('#sc-segar');
  b.classList.add('putar');
  window.api.segarkanCuaca();
  setTimeout(() => b.classList.remove('putar'), 4000);
});

window.api.onConfig(c => { cfg = c; applyTheme(); skalaDariConfig(); render(); });
window.api.bk.onStatus(st => { bkSt = st; if (KARTU_INI === 'kelasHariIni') muatKelasHariIni(true); render(); });
window.api.onCuaca(c => { cuaca = c; $('#sc-segar').classList.remove('putar'); render(); });

(async () => {
  cfg = await window.api.getConfig();
  cuaca = await window.api.cuaca();
  try { bkSt = await window.api.bk.status(); } catch { bkSt = null; }
  applyTheme();
  Object.entries(ID_KARTU).forEach(([k, id]) => { document.getElementById(id).hidden = k !== KARTU_INI; });
  render();
  skalaDariConfig(); laporUkuran();
  // perbarui tiap 20 detik (hitung mundur, bilah pelajaran, pergantian hari)
  setInterval(render, 20 * 1000);
})();
