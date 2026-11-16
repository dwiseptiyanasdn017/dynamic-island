'use strict';
/* Fungsi bersama untuk pulau, panel kelas, dan pengaturan. */
(function (g) {
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  // Disalin dari BukuKelas (app.js) agar pengingat ikut diam pada hari libur nasional.
  const LIBUR_NASIONAL = {"2026-01-01":"Tahun Baru 2026 Masehi","2026-01-16":"Isra Mikraj Nabi Muhammad SAW","2026-02-16":"Cuti bersama Tahun Baru Imlek","2026-02-17":"Tahun Baru Imlek 2577 Kongzili","2026-03-18":"Cuti bersama Hari Suci Nyepi","2026-03-19":"Hari Suci Nyepi","2026-03-20":"Cuti bersama Idulfitri","2026-03-21":"Idulfitri 1447 H","2026-03-22":"Idulfitri 1447 H","2026-03-23":"Cuti bersama Idulfitri","2026-03-24":"Cuti bersama Idulfitri","2026-04-03":"Wafat Yesus Kristus","2026-04-05":"Paskah","2026-05-01":"Hari Buruh Internasional","2026-05-14":"Kenaikan Yesus Kristus","2026-05-15":"Cuti bersama Kenaikan Yesus Kristus","2026-05-27":"Iduladha 1447 H","2026-05-28":"Cuti bersama Iduladha","2026-05-31":"Hari Raya Waisak","2026-06-01":"Hari Lahir Pancasila","2026-06-16":"1 Muharam Tahun Baru Islam 1448 H","2026-08-17":"Proklamasi Kemerdekaan","2026-08-25":"Maulid Nabi Muhammad SAW","2026-12-24":"Cuti bersama Natal","2026-12-25":"Kelahiran Yesus Kristus","2027-01-01":"Tahun Baru 2027 Masehi","2027-01-05":"Isra Mikraj Nabi Muhammad SAW","2027-02-05":"Cuti bersama Tahun Baru Imlek","2027-02-06":"Tahun Baru Imlek 2578 Kongzili","2027-03-08":"Hari Suci Nyepi","2027-03-09":"Cuti bersama Idulfitri","2027-03-10":"Idulfitri 1448 H","2027-03-11":"Idulfitri 1448 H","2027-03-12":"Cuti bersama Idulfitri","2027-03-15":"Cuti bersama Idulfitri","2027-03-25":"Cuti bersama Wafat Yesus Kristus","2027-03-26":"Wafat Yesus Kristus","2027-03-28":"Paskah","2027-05-01":"Hari Buruh Internasional","2027-05-06":"Kenaikan Yesus Kristus","2027-05-17":"Iduladha 1448 H","2027-05-18":"Cuti bersama Iduladha","2027-05-19":"Cuti bersama Waisak","2027-05-20":"Hari Raya Waisak","2027-06-01":"Hari Lahir Pancasila","2027-06-06":"1 Muharam Tahun Baru Islam 1449 H","2027-08-15":"Maulid Nabi Muhammad SAW","2027-08-17":"Proklamasi Kemerdekaan","2027-12-24":"Cuti bersama Natal","2027-12-25":"Kelahiran Yesus Kristus","2027-12-26":"Isra Mikraj Nabi Muhammad SAW"};
  const BUKAN_PELAJARAN = /istirahat|upacara|senam|sholat|shalat|literasi pagi/i;

  const pad = n => String(n).padStart(2, '0');
  const toMin = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
  const fmtMin = m => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.round(m % 60))}`;
  const tglStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const keDate = t => { const [y, m, d] = t.split('-').map(Number); return new Date(y, m - 1, d); };
  const tglPanjang = t => { const d = keDate(t); return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Jadwal satu hari, lengkap dengan menit mulai/selesai dan nomor jam pelajaran ("1-3"). */
  function jadwalHari(cfg, d) {
    const per = Number(cfg.menitPerJP) || 35;
    let ke = 0;
    return (cfg.jadwal[String(d.getDay())] || [])
      .filter(x => x.mulai && x.mapel)
      .map(x => { const s = toMin(x.mulai); const jp = Number(x.jp) || 1; return { ...x, jp, s, e: s + jp * per }; })
      .sort((a, b) => a.s - b.s)
      .map(x => {
        if (BUKAN_PELAJARAN.test(x.mapel)) return { ...x, pelajaran: false, jpKe: '' };
        const a = ke + 1; ke += x.jp;
        return { ...x, pelajaran: true, jpKe: a === ke ? String(a) : `${a}-${ke}` };
      });
  }

  /** Hari sekolah? Memakai libur nasional + (bila tersambung) libur sekolah dari BukuKelas. */
  function infoHari(t, presensi) {
    const c = presensi || { libur: [], masuk: [] };
    const dow = keDate(t).getDay();
    const sendiri = (c.libur || []).find(l => t >= l.tgl && t <= (l.sampai || l.tgl));
    let alasan = null;
    if (sendiri) alasan = sendiri.ket || 'Libur sekolah';
    else if (LIBUR_NASIONAL[t]) alasan = LIBUR_NASIONAL[t];
    else if (dow === 0) alasan = 'Hari Minggu';
    const dipaksa = !!alasan && (c.masuk || []).includes(t);
    return { sekolah: !alasan || dipaksa, alasan };
  }

  const ALIAS = {
    pai: /^(pai|agama|pendidikan agama)/i,
    pjok: /^(pjok|penjas|olahraga|pendidikan jasmani)/i,
    pp: /^(pp|ppkn|pkn|pancasila|pendidikan pancasila)/i,
    bind: /^(b\.? ?indo|bahasa indonesia|bi$)/i,
    bing: /^(b\.? ?ing|bahasa inggris|english)/i,
    mtk: /^(mtk|mat|matematika)/i,
    sr: /^(sbdp|sr|seni)/i,
    bmr: /^(bmr|budaya melayu|melayu)/i
  };
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  /** Cocokkan nama mapel di jadwal dengan mapel BukuKelas. Pilihan manual (peta) didahulukan. */
  function cocokMapel(nama, struktur, peta) {
    if (!nama || !struktur || !struktur.length) return null;
    if (peta && peta[nama]) { const m = struktur.find(x => x.id === peta[nama]); if (m) return m; }
    const n = norm(nama);
    let m = struktur.find(x => norm(x.nama) === n || norm(x.id) === n);
    if (m) return m;
    for (const x of struktur) if (ALIAS[x.id] && ALIAS[x.id].test(String(nama).trim())) return x;
    m = struktur.find(x => norm(x.nama).startsWith(n) || n.startsWith(norm(x.nama)));
    return m || null;
  }

  // Waktu sholat (kriteria Kemenag: Subuh -20°, Isya -18°, Ashar bayangan 1x, ihtiyat 2–3 menit).
  // Dengan koordinat bawaan, hasilnya cocok dengan jadwal Bimas Islam Kemenag Kab. Indragiri Hulu (selisih maks. 1 menit).
  function waktuSholat(date, lat, lon, tz, opt = {}) {
    const ih = { subuh: 2, dzuhur: 3, ashar: 2, maghrib: 2, isya: 2, ...(opt.ihtiyat || {}) };
    const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
    const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    const A = Math.floor((14 - m) / 12), Y = y + 4800 - A, M = m + 12 * A - 3;
    const jdn = d + Math.floor((153 * M + 2) / 5) + 365 * Y + Math.floor(Y / 4) - Math.floor(Y / 100) + Math.floor(Y / 400) - 32045;
    const jd = jdn - 0.5 - tz / 24 + 0.5; // tengah hari lokal kira-kira
    const D = jd - 2451545.0;
    const g = rad((357.529 + 0.98560028 * D) % 360);
    const q = (280.459 + 0.98564736 * D) % 360;
    const L = rad((q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) % 360);
    const e = rad(23.439 - 0.00000036 * D);
    const RA = deg(Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L))) / 15;
    const decl = Math.asin(Math.sin(e) * Math.sin(L));
    let EqT = q / 15 - ((RA % 24) + 24) % 24; EqT = ((EqT + 12) % 24 + 24) % 24 - 12;
    const transit = 12 + tz - lon / 15 - EqT;
    const phi = rad(lat);
    const ha = alt => deg(Math.acos((Math.sin(rad(alt)) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl)))) / 15;
    const altAshar = deg(Math.atan(1 / (1 + Math.tan(Math.abs(phi - decl)))));
    const raw = {
      subuh: transit - ha(-20),
      terbit: transit - ha(-0.8333),
      dzuhur: transit,
      ashar: transit + ha(altAshar),
      maghrib: transit + ha(-0.8333),
      isya: transit + ha(-18)
    };
    const out = {};
    for (const k of Object.keys(raw)) {
      let menit = raw[k] * 60 + (k === 'terbit' ? -(opt.ihtiyatTerbit ?? 2) : (ih[k] || 0));
      menit = k === 'terbit' ? Math.floor(menit) : Math.ceil(menit);
      out[k] = menit;
    }
    out.imsak = out.subuh - 10;
    return out;
  }
  const NAMA_SHOLAT = [['subuh', 'Subuh'], ['dzuhur', 'Dzuhur'], ['ashar', 'Ashar'], ['maghrib', 'Maghrib'], ['isya', 'Isya']];

  // ---------- Tema ----------
  // latarCss dipakai bila ada (gradien banyak warna); kalau tidak, gradien dari warnaLatar -> warnaLatar2.
  const TEMA = [
    { id: 'hitam', nama: 'Hitam Klasik', warnaLatar: '#000000', warnaLatar2: '', warnaAksen: '#4ade80', warnaTeks: '#ffffff', cahaya: false },
    { id: 'malam', nama: 'Malam Biru', warnaLatar: '#0f172a', warnaLatar2: '#1e3a5f', sudut: 135, warnaAksen: '#38bdf8', warnaTeks: '#f1f5f9', cahaya: false },
    { id: 'senja', nama: 'Senja', warnaLatar: '#2d1b4e', warnaLatar2: '#b8461f', sudut: 120, warnaAksen: '#ffd166', warnaTeks: '#fff7ed', cahaya: true },
    { id: 'aurora', nama: 'Aurora', warnaLatar: '#0b3d2e', warnaLatar2: '#3a1c71', sudut: 135, warnaAksen: '#7cf5c4', warnaTeks: '#ecfdf5', cahaya: true },
    { id: 'laut', nama: 'Laut Dalam', warnaLatar: '#03254c', warnaLatar2: '#0e7490', sudut: 160, warnaAksen: '#67e8f9', warnaTeks: '#ecfeff', cahaya: false },
    { id: 'hutan', nama: 'Hutan', warnaLatar: '#1f2b22', warnaLatar2: '#2f4a34', sudut: 135, warnaAksen: '#a3b18a', warnaTeks: '#edf1e6', cahaya: false },
    { id: 'kayu', nama: 'Kayu', warnaLatar: '#2b2118', warnaLatar2: '#4a3424', sudut: 135, warnaAksen: '#d4a373', warnaTeks: '#f5ebe0', cahaya: false },
    { id: 'songket', nama: 'Songket Melayu', warnaLatar: '#4a0d0d', warnaLatar2: '#7a1f1f', sudut: 135, warnaAksen: '#f2c14e', warnaTeks: '#fff8e7', cahaya: true },
    { id: 'neon', nama: 'Neon', warnaLatar: '#050505', warnaLatar2: '#111827', sudut: 180, warnaAksen: '#00f0ff', warnaTeks: '#ffffff', cahaya: true },
    { id: 'ceria', nama: 'Pelangi Ceria', latarCss: 'linear-gradient(120deg,#e11d48,#d97706 25%,#059669 50%,#2563eb 75%,#7c3aed)', warnaLatar: '#3b82f6', warnaLatar2: '', warnaAksen: '#ffffff', warnaTeks: '#ffffff', cahaya: true },
    { id: 'sakura', nama: 'Sakura', warnaLatar: '#ffe4ec', warnaLatar2: '#ffc9d9', sudut: 135, warnaAksen: '#db2777', warnaTeks: '#3b0a1e', cahaya: false },
    { id: 'langit', nama: 'Langit Pagi', warnaLatar: '#e0f2fe', warnaLatar2: '#bae6fd', sudut: 160, warnaAksen: '#0369a1', warnaTeks: '#0c2a43', cahaya: false },
    { id: 'permen', nama: 'Permen Pastel', warnaLatar: '#fdf2f8', warnaLatar2: '#e0e7ff', sudut: 120, warnaAksen: '#7c3aed', warnaTeks: '#2e1065', cahaya: false },
    { id: 'terang', nama: 'Terang', warnaLatar: '#f5f5f4', warnaLatar2: '', warnaAksen: '#15803d', warnaTeks: '#1c1917', cahaya: false }
  ];
  // Warna mapel sama dengan BukuKelas (PALET di app.js)
  const PALET_MAPEL = ['#0F8B8D', '#E4572E', '#B23A48', '#2E86DE', '#7B4FB8', '#E3A400', '#3C8D2F', '#5D6D7E'];
  function terang(hex) {
    const h = String(hex || '#000').replace('#', '');
    const v = h.length === 3 ? h.split('').map(c => parseInt(c + c, 16)) : [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    const [r, gg, b] = v.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * gg + 0.0722 * b;
  }
  /** Ubah pengaturan tampilan menjadi variabel CSS. */
  function varTema(t, aksenGanti) {
    const aksen = aksenGanti || t.warnaAksen || '#4ade80';
    const latar = t.latarCss || (t.warnaLatar2 ? `linear-gradient(${Number(t.sudut) || 135}deg, ${t.warnaLatar}, ${t.warnaLatar2})` : t.warnaLatar);
    const gelap = terang(t.warnaLatar) < 0.4;
    return {
      '--latar': latar,
      '--aksen': aksen,
      '--aksen-teks': terang(aksen) > 0.35 ? '#0b0b0b' : '#ffffff',
      '--teks': t.warnaTeks || '#fff',
      '--cahaya': t.cahaya
        ? `0 0 0 1.5px color-mix(in srgb, ${aksen} 70%, transparent), 0 0 10px color-mix(in srgb, ${aksen} 35%, transparent), 0 6px 14px rgba(0,0,0,.3)`
        : (gelap ? '0 6px 14px rgba(0,0,0,.35)' : '0 5px 12px rgba(0,0,0,.16)'),
      '--bayang': t.latarCss ? '0 1px 2px rgba(0,0,0,.45)' : 'none'
    };
  }

  // Kode cuaca WMO (Open-Meteo) -> keterangan
  function cuacaKode(k, siang = true) {
    k = Number(k);
    if (k === 0) return [siang ? '☀️' : '🌙', 'Cerah'];
    if (k === 1) return [siang ? '🌤️' : '🌙', 'Cerah berawan'];
    if (k === 2) return ['⛅', 'Berawan'];
    if (k === 3) return ['☁️', 'Mendung'];
    if (k === 45 || k === 48) return ['🌫️', 'Berkabut'];
    if (k >= 51 && k <= 57) return ['🌦️', 'Gerimis'];
    if (k === 61 || k === 80) return ['🌦️', 'Hujan ringan'];
    if (k === 63 || k === 81) return ['🌧️', 'Hujan'];
    if (k === 65 || k === 82 || k === 66 || k === 67) return ['🌧️', 'Hujan lebat'];
    if (k >= 71 && k <= 77) return ['🌨️', 'Salju'];
    if (k >= 95) return ['⛈️', 'Badai petir'];
    return ['🌡️', 'Cuaca'];
  }

  g.Bersama = { HARI, BULAN, LIBUR_NASIONAL, pad, toMin, fmtMin, tglStr, keDate, tglPanjang, esc, jadwalHari, infoHari, cocokMapel, waktuSholat, NAMA_SHOLAT, TEMA, PALET_MAPEL, varTema, terang, cuacaKode };
})(typeof window !== 'undefined' ? window : globalThis);
