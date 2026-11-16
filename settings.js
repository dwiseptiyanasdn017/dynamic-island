'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MAPEL = ['PAI', 'Pendidikan Pancasila', 'Bahasa Indonesia', 'Matematika', 'PJOK', 'Seni Rupa', 'Bahasa Inggris', 'BMR',
  'Istirahat', 'Upacara', 'Kegiatan Adiwiyata', 'Literasi', 'Pramuka', 'Shalat Dhuha', 'Senam Pagi'];
const TEMA = Bersama.TEMA;

let cfg = null;
let hariAktif = '1';
const pad = n => String(n).padStart(2, '0');
const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
const fmtMin = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Navigasi ----------
$$('nav a').forEach(a => a.addEventListener('click', () => {
  $$('nav a').forEach(x => x.classList.toggle('on', x === a));
  $$('.pane').forEach(p => p.classList.toggle('on', p.id === 'p-' + a.dataset.p));
}));

// ---------- Isi form ----------
const T_FIELDS = ['warnaLatar', 'warnaAksen', 'warnaTeks', 'lebarRingkas', 'jarakAtas', 'transparansi', 'modeBuka', 'formatJam'];
const P_FIELDS = ['menitSebelum', 'saatMulai', 'saatSelesai', 'suara', 'notifWindows', 'lamaTampil', 'tawarJurnal', 'internet'];
const SH_BAWAAN = { lat: -0.48, lon: 102.44 };
let bkSt = null;
const bkStruktur = () => (bkSt && bkSt.masuk && bkSt.data ? bkSt.data.struktur : []);

function setVal(id, v) { const el = $('#' + id); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; }
function getVal(id) { const el = $('#' + id); if (el.type === 'checkbox') return el.checked; if (el.type === 'number' || el.type === 'range') return Number(el.value); return el.value; }

function isiForm() {
  T_FIELDS.forEach(f => setVal(f, cfg.tampilan[f]));
  const tp = cfg.tampilan;
  temaId = tp.tema || 'kustom';
  setVal('pakaiGradien', !!tp.warnaLatar2); setVal('warnaLatar2', tp.warnaLatar2 || tp.warnaLatar); setVal('sudut', tp.sudut || 135);
  setVal('cahaya', !!tp.cahaya); setVal('aksenMapel', tp.aksenMapel !== false);
  karId = window.karakterId(tp.karakter);
  setVal('karakterTampil', tp.karakterTampil !== false); setVal('karakterGerak', tp.karakterGerak !== false);
  renderGaleriTema(); renderGaleriKar(); isiPilKecil(); isiBeranda();
  const mi = (cfg.pengingat || {}).minum || {}, bt = (cfg.pengingat || {}).baterai || {};
  setVal('mi-aktif', mi.aktif !== false); setVal('mi-interval', mi.interval || 60); setVal('mi-mulai', mi.mulai || '07:00'); setVal('mi-selesai', mi.selesai || '14:00'); setVal('mi-sekolah', mi.hanyaSekolah !== false);
  setVal('bt-aktif', bt.aktif !== false); setVal('bt-batas', bt.batas || 20); setVal('bt-kritis', bt.kritis || 10);
  const cu = cfg.cuaca || {};
  setVal('cu-aktif', cu.aktif !== false); setVal('cu-hujan', cu.peringatanHujan !== false); setVal('cu-nama', cu.nama || ''); setVal('cu-lat', cu.lat ?? -0.48); setVal('cu-lon', cu.lon ?? 102.44);
  P_FIELDS.forEach(f => setVal(f, cfg.pengingat[f]));
  setVal('menitPerJP', cfg.menitPerJP);
  setVal('timerPreset', (cfg.timerPreset || []).join(', '));
  setVal('autostart', cfg.umum.autostart);
  setVal('sembunyiPresentasi', cfg.umum.sembunyiPresentasi !== false);
  setVal('updateOtomatis', cfg.umum.updateOtomatis !== false); setVal('fiturMedia', cfg.umum.fiturMedia !== false); setVal('fiturKontrol', cfg.umum.fiturKontrol !== false);
  const sh = cfg.sholat || {};
  setVal('sh-aktif', sh.aktif !== false); setVal('sh-menit', sh.menitSebelum ?? 10); setVal('sh-adzan', sh.saatAdzan !== false);
  setVal('sh-lat', sh.lat ?? SH_BAWAAN.lat); setVal('sh-lon', sh.lon ?? SH_BAWAAN.lon);
  tampilSholat();
  const wg = cfg.widget || {};
  setVal('wg-aktif', wg.aktif !== false); setVal('wg-k-jam', (wg.kartu || {}).jam !== false); setVal('wg-k-sc', (wg.kartu || {}).sholatCuaca !== false); setVal('wg-k-jd', (wg.kartu || {}).jadwal !== false); setVal('wg-k-kal', (wg.kartu || {}).kalender !== false); setVal('wg-k-kh', (wg.kartu || {}).kelasHariIni !== false); setVal('wg-k-tg', (wg.kartu || {}).tugas !== false); setVal('wg-k-ct', (wg.kartu || {}).catatan !== false); setVal('wg-k-ut', (wg.kartu || {}).ulangTahun !== false); setVal('wg-kunci', !!wg.kunci); setVal('wg-op', wg.transparansi || 60);
  setVal('bkUrl', (cfg.bukukelas || {}).url || '');
  setVal('bkKey', (cfg.bukukelas || {}).anonKey || '');
  labelRange();
  renderHari(); renderJadwal(); renderKhusus(); renderPintasan(); renderKaldik();
}
function labelRange() {
  $('#lebarVal').textContent = $('#lebarRingkas').value + ' px';
  $('#opVal').textContent = $('#transparansi').value + '%';
  $('#wgOpVal').textContent = $('#wg-op').value + '%';
}
['lebarRingkas', 'transparansi', 'wg-op'].forEach(id => $('#' + id).addEventListener('input', labelRange));

// ---------- Galeri tema ----------
let temaId = 'hitam';
function gayaMini(t) {
  const v = Bersama.varTema(t);
  return `background:${v['--latar']};color:${v['--teks']};box-shadow:${v['--cahaya']}`;
}
function renderGaleriTema() {
  const kini = temaId;
  const item = [...TEMA, { id: 'kustom', nama: 'Kustom (warna sendiri)', ...bacaWarna() }];
  $('#galeriTema').innerHTML = item.map(t => `<button type="button" data-id="${t.id}" class="${t.id === kini ? 'on' : ''}">
      <span class="mini" style="${gayaMini(t)}">10:30 <span style="opacity:.85;font-weight:400">Matematika</span><i style="background:${t.warnaAksen}"></i></span>${esc(t.nama)}</button>`).join('');
  $$('#galeriTema button').forEach(b => b.addEventListener('click', () => {
    temaId = b.dataset.id;
    const t = TEMA.find(x => x.id === temaId);
    if (t) {
      setVal('warnaLatar', t.warnaLatar); setVal('warnaLatar2', t.warnaLatar2 || t.warnaLatar);
      setVal('pakaiGradien', !!t.warnaLatar2); setVal('sudut', t.sudut || 135);
      setVal('warnaAksen', t.warnaAksen); setVal('warnaTeks', t.warnaTeks); setVal('cahaya', !!t.cahaya);
    }
    renderGaleriTema();
  }));
}
function bacaWarna() {
  return {
    warnaLatar: getVal('warnaLatar'), warnaLatar2: getVal('pakaiGradien') ? getVal('warnaLatar2') : '',
    sudut: getVal('sudut') || 135, warnaAksen: getVal('warnaAksen'), warnaTeks: getVal('warnaTeks'), cahaya: getVal('cahaya')
  };
}
['warnaLatar', 'warnaLatar2', 'pakaiGradien', 'sudut', 'warnaAksen', 'warnaTeks', 'cahaya'].forEach(id =>
  $('#' + id).addEventListener('input', () => { temaId = 'kustom'; renderGaleriTema(); }));

// ---------- Beranda ----------
const TATA = [
  ['kotak', 'Kotak Widget', '<i class="a"></i><i></i><i></i><i></i><i></i><i></i>'],
  ['daftar', 'Jam + Daftar', '<i class="a"></i><i></i><i></i><i></i><i></i>'],
  ['minimal', 'Minimalis', '<i class="a"></i><i></i>'],
  ['klasik', 'Klasik', '<i class="a"></i><i></i><i></i><i></i>']
];
const BLOK = { jam: ['🕐 Jam & tanggal', ''], pelajaran: ['📘 Pelajaran', 'sekarang / berikutnya'], sholat: ['🕌 Sholat', 'waktu sholat berikutnya'],
  cuaca: ['⛅ Cuaca', 'suhu & peringatan hujan'], baterai: ['🔋 Baterai', ''], kehadiran: ['👧 Kehadiran kelas', 'dari BukuKelas (perlu masuk)'] };
let beranda = { tata: 'kotak', blok: [] };
function isiBeranda() {
  const b = (cfg.tampilan || {}).beranda || {};
  const blok = (Array.isArray(b.blok) ? b.blok : []).filter(x => BLOK[x.id]);
  for (const id of Object.keys(BLOK)) if (!blok.some(x => x.id === id)) blok.push({ id, on: id !== 'kehadiran' });
  beranda = { tata: b.tata || 'kotak', blok };
  renderBerandaSet();
}
function renderBerandaSet() {
  $('#galeriTata').innerHTML = TATA.map(([id, nama, skema]) => `<button type="button" data-id="${id}" class="${id === beranda.tata ? 'on' : ''}"><span class="skema ${id}">${skema}</span>${nama}</button>`).join('');
  $('#daftarBlok').innerHTML = beranda.blok.map((x, i) => `<li><input type="checkbox" data-i="${i}" ${x.on ? 'checked' : ''}>
    <span class="nm">${BLOK[x.id][0]} <span class="ket">${BLOK[x.id][1]}</span></span>
    <button type="button" data-naik="${i}" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" data-turun="${i}" ${i === beranda.blok.length - 1 ? 'disabled' : ''}>▼</button></li>`).join('');
}
$('#galeriTata').addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) { beranda.tata = b.dataset.id; renderBerandaSet(); } });
$('#daftarBlok').addEventListener('click', e => {
  const n = e.target.dataset.naik, t = e.target.dataset.turun, c = e.target.dataset.i;
  if (c !== undefined && e.target.type === 'checkbox') { beranda.blok[c].on = e.target.checked; return; }
  const geser = (i, j) => { const a = beranda.blok; [a[i], a[j]] = [a[j], a[i]]; renderBerandaSet(); };
  if (n !== undefined) geser(+n, +n - 1);
  if (t !== undefined) geser(+t, +t + 1);
});

// ---------- Isi pil kecil ----------
const PK = ['karakter', 'jam', 'detik', 'sisa', 'cuaca', 'baterai'];
const PKI = ['timer', 'pelajaran', 'sholat', 'musik', 'berikutnya', 'tanggal'];
const PK_BAWAAN = { karakter: true, jam: true, detik: false, sisa: true, baterai: true, cuaca: false, lebarOtomatis: true,
  info: { timer: true, pelajaran: true, sholat: true, musik: true, berikutnya: true, tanggal: true } };
function isiPilKecil() {
  const p = { ...PK_BAWAAN, ...((cfg.tampilan || {}).pilKecil || {}) };
  const info = { ...PK_BAWAAN.info, ...(p.info || {}) };
  PK.forEach(k => setVal('pk-' + k, p[k]));
  PKI.forEach(k => setVal('pk-i-' + k, info[k]));
  setVal('pk-otomatis', p.lebarOtomatis);
  contohPil();
}
function bacaPilKecil() {
  const p = { lebarOtomatis: getVal('pk-otomatis'), info: {} };
  PK.forEach(k => { p[k] = getVal('pk-' + k); });
  PKI.forEach(k => { p.info[k] = getVal('pk-i-' + k); });
  return p;
}
function contohPil() {
  const p = bacaPilKecil(), k = window.KARAKTER[window.karakterId(karId)];
  const tengah = p.info.pelajaran ? 'Matematika' : p.info.sholat ? 'Dzuhur 11:58' : p.info.berikutnya ? 'PJOK 10:10' : p.info.tanggal ? 'Senin, 16 Nov' : '';
  const kanan = [p.sisa && tengah ? '25 mnt' : '', p.cuaca ? '⛅29°' : '', p.baterai ? '⚡75%' : ''].filter(Boolean).join(' · ');
  $('#pkContoh').innerHTML = [p.karakter && k ? `<img src="${k.src}" alt="">` : '', p.jam ? `<b>11:46${p.detik ? '<small>:21</small>' : ''}</b>` : '',
    tengah ? `<span>${tengah}</span>` : '', kanan ? `<span style="opacity:.8;font-size:10px">${kanan}</span>` : ''].join('');
}
[...PK.map(k => 'pk-' + k), ...PKI.map(k => 'pk-i-' + k), 'pk-otomatis'].forEach(id => $('#' + id).addEventListener('change', contohPil));

// ---------- Galeri karakter ----------
let karId = 'oren';
async function renderGaleriKar() {
  const kustom = cfg.tampilan.karakterKustom || [];
  const data = {};
  for (const k of kustom) data[k.id] = await window.api.karakterData(k.id);
  const item = [
    ...Object.entries(window.KARAKTER).map(([id, k]) => ({ id, nama: k.nama, gbr: k.html })),
    ...kustom.map(k => ({ id: k.id, nama: k.nama, gbr: data[k.id] ? `<img src="${data[k.id]}" alt="">` : '?', hapus: true })),
    { id: 'none', nama: 'Tanpa karakter', gbr: '<span style="font-size:28px;line-height:56px;color:#b7ab9c">∅</span>' }
  ];
  $('#galeriKar').innerHTML = item.map(k => `<button type="button" data-id="${esc(k.id)}" class="${k.id === karId ? 'on' : ''}">
      ${k.hapus ? `<span class="hapus" data-hapus="${esc(k.id)}" title="Hapus">✕</span>` : ''}<span class="gbr">${k.gbr}</span>${esc(k.nama)}</button>`).join('');
}
$('#galeriKar').addEventListener('click', async e => {
  const h = e.target.closest('[data-hapus]');
  if (h) {
    e.stopPropagation();
    if (!confirm('Hapus gambar karakter ini?')) return;
    cfg = await window.api.karakterHapus(h.dataset.hapus);
    if (karId === h.dataset.hapus) karId = window.karakterId(cfg.tampilan.karakter);
    renderGaleriKar(); return;
  }
  const b = e.target.closest('button[data-id]'); if (!b) return;
  karId = b.dataset.id; renderGaleriKar(); contohPil();
});
$('#unggahKar').addEventListener('click', () => $('#fileKar').click());
$('#fileKar').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  if (f.size > 3 * 1024 * 1024) { alert('Ukuran gambar maksimal 3 MB.'); return; }
  const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  try {
    const item = await window.api.karakterSimpan(dataUrl, f.name.replace(/\.[^.]+$/, ''));
    cfg = await window.api.getConfig();
    karId = item.id; renderGaleriKar();
    status('✓ Karakter diunggah dan langsung dipakai');
  } catch (err) { alert(String(err.message || err).replace(/^Error invoking remote method[^:]*: (Error: )?/, '')); }
});
$('#mapelList').innerHTML = MAPEL.map(m => `<option value="${m}">`).join('');

// ---------- Jadwal ----------
function bacaPetaMapel() {
  const peta = { ...((cfg.bukukelas || {}).mapelJadwal || {}) };
  $$('#jadwalBody tr').forEach(tr => {
    const nama = tr.querySelector('[data-k=mapel]').value.trim(), sel = tr.querySelector('[data-k=bk]');
    if (!nama || sel.disabled) return;
    if (sel.value) peta[nama] = sel.value; else delete peta[nama];
  });
  cfg.bukukelas = { ...(cfg.bukukelas || {}), mapelJadwal: peta };
}
function bacaJadwalDariTabel() {
  bacaPetaMapel();
  cfg.jadwal[hariAktif] = $$('#jadwalBody tr').map(tr => ({
    mulai: tr.querySelector('[data-k=mulai]').value,
    jp: Number(tr.querySelector('[data-k=jp]').value) || 1,
    mapel: tr.querySelector('[data-k=mapel]').value.trim(),
    ket: tr.querySelector('[data-k=ket]').value.trim()
  })).filter(x => x.mulai || x.mapel);
}
function renderHari() {
  $('#days').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d =>
    `<button data-d="${d}" class="${String(d) === hariAktif ? 'on' : ''}">${HARI[d]} (${(cfg.jadwal[String(d)] || []).length})</button>`).join('');
  $$('#days button').forEach(b => b.addEventListener('click', () => {
    bacaJadwalDariTabel(); hariAktif = b.dataset.d; renderHari(); renderJadwal();
  }));
  $('#copyTarget').innerHTML = [1, 2, 3, 4, 5, 6, 0].filter(d => String(d) !== hariAktif)
    .map(d => `<option value="${d}">${HARI[d]}</option>`).join('');
}
function hitungSelesai(tr) {
  const m = tr.querySelector('[data-k=mulai]').value, jp = Number(tr.querySelector('[data-k=jp]').value) || 1;
  tr.querySelector('.selesai').textContent = m ? fmtMin(toMin(m) + jp * (getVal('menitPerJP') || 35)) : '—';
}
function ringkasJadwal() {
  const rows = $$('#jadwalBody tr');
  let jp = 0, bentrok = [];
  const data = rows.map(tr => ({ m: tr.querySelector('[data-k=mulai]').value, jp: Number(tr.querySelector('[data-k=jp]').value) || 1, mp: tr.querySelector('[data-k=mapel]').value }))
    .filter(x => x.m).sort((a, b) => toMin(a.m) - toMin(b.m));
  const per = getVal('menitPerJP') || 35;
  data.forEach((x, i) => {
    if (!/istirahat|upacara/i.test(x.mp)) jp += x.jp;
    const n = data[i + 1];
    if (n && toMin(x.m) + x.jp * per > toMin(n.m)) bentrok.push(`${x.mp || '?'} bertabrakan dengan ${n.mp || '?'}`);
  });
  $('#jadwalSum').innerHTML = `Total ${jp} JP pelajaran pada hari ${HARI[hariAktif]}.` +
    (bentrok.length ? ` <b style="color:#b4493c">⚠ ${bentrok.join('; ')}</b>` : '');
}
function barisJadwal(x = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td class="t"><input type="time" data-k="mulai" value="${esc(x.mulai || '')}"></td>
    <td class="n"><input type="number" data-k="jp" min="1" max="10" value="${Number(x.jp) || 1}"></td>
    <td><input list="mapelList" data-k="mapel" value="${esc(x.mapel || '')}" placeholder="Matematika"></td>
    <td class="k"><input data-k="ket" value="${esc(x.ket || '')}" placeholder="Kelas 2C"></td>
    <td class="s selesai"></td>
    <td class="bk"><select data-k="bk"></select></td>
    <td class="x"><button class="del" title="Hapus">✕</button></td>`;
  tr.querySelectorAll('input').forEach(i => i.addEventListener('input', () => { hitungSelesai(tr); ringkasJadwal(); }));
  tr.querySelector('[data-k=mapel]').addEventListener('change', () => isiBk(tr));
  isiBk(tr);
  tr.querySelector('.del').addEventListener('click', () => { tr.remove(); ringkasJadwal(); });
  $('#jadwalBody').appendChild(tr);
  hitungSelesai(tr);
  return tr;
}
function isiBk(tr) {
  const sel = tr.querySelector('[data-k=bk]');
  const nama = tr.querySelector('[data-k=mapel]').value.trim();
  const st = bkStruktur();
  if (!st.length) { sel.innerHTML = '<option value="">(belum tersambung)</option>'; sel.disabled = true; return; }
  sel.disabled = false;
  const peta = (cfg.bukukelas || {}).mapelJadwal || {};
  const pilihan = sel.dataset.v !== undefined ? sel.dataset.v : (peta[nama] || '');
  const otomatis = Bersama.cocokMapel(nama, st, {});
  sel.innerHTML = `<option value="">${otomatis ? 'Otomatis: ' + esc(otomatis.nama) : 'Bukan mapel BukuKelas'}</option>` +
    st.map(m => `<option value="${esc(m.id)}">${esc(m.nama)}</option>`).join('');
  sel.value = st.some(m => m.id === pilihan) ? pilihan : '';
  sel.onchange = () => { sel.dataset.v = sel.value; };
}
function renderJadwal() {
  $('#jadwalBody').innerHTML = '';
  (cfg.jadwal[hariAktif] || []).slice().sort((a, b) => toMin(a.mulai) - toMin(b.mulai)).forEach(barisJadwal);
  ringkasJadwal();
}
$('#addRow').addEventListener('click', () => { barisJadwal().querySelector('[data-k=mulai]').focus(); ringkasJadwal(); });
$('#autoNext').addEventListener('click', () => {
  const rows = $$('#jadwalBody tr');
  let mulai = '07:15';
  if (rows.length) {
    const last = rows.map(tr => ({ m: tr.querySelector('[data-k=mulai]').value, jp: Number(tr.querySelector('[data-k=jp]').value) || 1 }))
      .filter(x => x.m).sort((a, b) => toMin(b.m) - toMin(a.m))[0];
    if (last) mulai = fmtMin(toMin(last.m) + last.jp * (getVal('menitPerJP') || 35));
  }
  barisJadwal({ mulai, jp: 1 }).querySelector('[data-k=mapel]').focus();
  ringkasJadwal();
});
$('#copyDay').addEventListener('click', () => {
  bacaJadwalDariTabel();
  const t = $('#copyTarget').value;
  if (!confirm(`Timpa jadwal ${HARI[t]} dengan jadwal ${HARI[hariAktif]}?`)) return;
  cfg.jadwal[t] = structuredClone(cfg.jadwal[hariAktif]);
  renderHari();
  status(`Jadwal disalin ke ${HARI[t]} (belum disimpan)`);
});
$('#menitPerJP').addEventListener('input', () => { $$('#jadwalBody tr').forEach(hitungSelesai); ringkasJadwal(); });

// ---------- Pengingat khusus ----------
function barisKhusus(r = {}) {
  const hari = Array.isArray(r.hari) ? r.hari : [1, 2, 3, 4, 5, 6];
  const tr = document.createElement('tr');
  tr.innerHTML = `<td class="t"><input type="time" data-k="jam" value="${esc(r.jam || '')}"></td>
    <td><input data-k="teks" value="${esc(r.teks || '')}" placeholder="Rapat dewan guru"></td>
    <td><div class="hari-chk">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" value="${d}" ${hari.includes(d) ? 'checked' : ''}>${HARI[d].slice(0, 3)}</label>`).join('')}</div></td>
    <td class="x"><button class="del" title="Hapus">✕</button></td>`;
  tr.querySelector('.del').addEventListener('click', () => tr.remove());
  $('#khususBody').appendChild(tr);
}
function renderKhusus() { $('#khususBody').innerHTML = ''; (cfg.pengingatKhusus || []).forEach(barisKhusus); }
$('#addKhusus').addEventListener('click', () => barisKhusus());

// ---------- Kalender pendidikan ----------
const JENIS_KD = [['libur', 'Libur'], ['ujian', 'Asesmen / ujian'], ['kegiatan', 'Kegiatan'], ['rapor', 'Rapor']];
function barisKaldik(r = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><input type="date" data-k="mulai" value="${esc(r.mulai || '')}"></td>
    <td><input type="date" data-k="sampai" value="${esc(r.sampai && r.sampai !== r.mulai ? r.sampai : '')}"></td>
    <td><input data-k="nama" value="${esc(r.nama || '')}" placeholder="Sumatif Akhir Semester (SAS) Ganjil"></td>
    <td><select data-k="jenis">${JENIS_KD.map(([v, n]) => `<option value="${v}" ${(r.jenis || 'kegiatan') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
    <td class="x"><button class="del" title="Hapus">✕</button></td>`;
  tr.querySelector('.del').addEventListener('click', () => tr.remove());
  $('#kaldikBody').appendChild(tr);
}
function renderKaldik() { $('#kaldikBody').innerHTML = ''; (cfg.kaldik || []).forEach(barisKaldik); }
$('#addKaldik').addEventListener('click', () => barisKaldik());
function bacaKaldik() {
  return $$('#kaldikBody tr').map(tr => {
    const v = k => tr.querySelector(`[data-k=${k}]`).value.trim();
    const mulai = v('mulai'), sampai = v('sampai');
    return { mulai, sampai: sampai && sampai > mulai ? sampai : mulai, nama: v('nama'), jenis: v('jenis') };
  }).filter(x => x.mulai && x.nama).sort((a, b) => a.mulai.localeCompare(b.mulai));
}

// ---------- Pintasan ----------
function barisPintasan(p = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td class="ik"><span class="ikon-p"></span></td><td><input data-k="nama" value="${esc(p.nama || '')}" placeholder="BukuKelas"></td>
    <td><input data-k="target" value="${esc(p.target || '')}" placeholder="https://… atau D:\\Folder atau winword"></td>
    <td class="x"><button class="del" title="Hapus">✕</button></td>`;
  tr.querySelector('.del').addEventListener('click', () => tr.remove());
  $('#pintasanBody').appendChild(tr);
  const muatIkon = segar => {
    const t = tr.querySelector('[data-k=target]').value.trim(), el = tr.querySelector('.ikon-p');
    el.textContent = (tr.querySelector('[data-k=nama]').value.trim() || '?').charAt(0).toUpperCase();
    if (t) window.api.ikonPintasan(t, segar).then(src => { if (src) el.innerHTML = `<img src="${src}" alt="">`; }).catch(() => {});
  };
  tr.querySelector('[data-k=target]').addEventListener('change', () => muatIkon(true));
  muatIkon(false);
}
function renderPintasan() { $('#pintasanBody').innerHTML = ''; (cfg.pintasan || []).forEach(barisPintasan); }
$('#addPintasan').addEventListener('click', () => barisPintasan());

// ---------- Kumpulkan & simpan ----------
function kumpulkan() {
  bacaJadwalDariTabel();
  T_FIELDS.forEach(f => cfg.tampilan[f] = getVal(f));
  Object.assign(cfg.tampilan, bacaWarna(), {
    tema: temaId, aksenMapel: getVal('aksenMapel'),
    karakter: karId, karakterTampil: getVal('karakterTampil'), karakterGerak: getVal('karakterGerak'),
    pilKecil: bacaPilKecil(),
    beranda: { tata: beranda.tata, blok: beranda.blok.map(x => ({ id: x.id, on: !!x.on })) }
  });
  P_FIELDS.forEach(f => cfg.pengingat[f] = getVal(f));
  cfg.pengingat.minum = { aktif: getVal('mi-aktif'), interval: getVal('mi-interval') || 60, mulai: getVal('mi-mulai') || '07:00', selesai: getVal('mi-selesai') || '14:00', hanyaSekolah: getVal('mi-sekolah') };
  cfg.pengingat.baterai = { aktif: getVal('bt-aktif'), batas: getVal('bt-batas') || 20, kritis: getVal('bt-kritis') || 10 };
  cfg.cuaca = { aktif: getVal('cu-aktif'), peringatanHujan: getVal('cu-hujan'), nama: getVal('cu-nama').trim(), lat: getVal('cu-lat'), lon: getVal('cu-lon') };
  cfg.menitPerJP = getVal('menitPerJP') || 35;
  cfg.timerPreset = String($('#timerPreset').value).split(/[,; ]+/).map(Number).filter(n => n > 0);
  cfg.umum.autostart = getVal('autostart');
  cfg.umum.sembunyiPresentasi = getVal('sembunyiPresentasi');
  cfg.umum.updateOtomatis = getVal('updateOtomatis'); cfg.umum.fiturMedia = getVal('fiturMedia'); cfg.umum.fiturKontrol = getVal('fiturKontrol');
  cfg.widget = { ...(cfg.widget || {}), aktif: getVal('wg-aktif'), kunci: getVal('wg-kunci'), transparansi: getVal('wg-op') || 60, kartu: { jam: getVal('wg-k-jam'), sholatCuaca: getVal('wg-k-sc'), jadwal: getVal('wg-k-jd'), kalender: getVal('wg-k-kal'), kelasHariIni: getVal('wg-k-kh'), tugas: getVal('wg-k-tg'), catatan: getVal('wg-k-ct'), ulangTahun: getVal('wg-k-ut') } };
  cfg.sholat = { aktif: getVal('sh-aktif'), menitSebelum: getVal('sh-menit'), saatAdzan: getVal('sh-adzan'), lat: getVal('sh-lat'), lon: getVal('sh-lon') };
  cfg.bukukelas = { ...(cfg.bukukelas || {}), url: getVal('bkUrl').trim(), anonKey: getVal('bkKey').trim() };
  cfg.pengingatKhusus = $$('#khususBody tr').map(tr => ({
    jam: tr.querySelector('[data-k=jam]').value,
    teks: tr.querySelector('[data-k=teks]').value.trim(),
    hari: [...tr.querySelectorAll('.hari-chk input:checked')].map(c => Number(c.value))
  })).filter(r => r.jam && r.teks);
  cfg.kaldik = bacaKaldik();
  cfg.pintasan = $$('#pintasanBody tr').map(tr => ({
    nama: tr.querySelector('[data-k=nama]').value.trim(),
    target: tr.querySelector('[data-k=target]').value.trim()
  })).filter(p => p.nama && p.target);
  return cfg;
}
let stT;
function status(t) { $('#status').textContent = t; clearTimeout(stT); stT = setTimeout(() => $('#status').textContent = '', 3500); }

$('#saveBtn').addEventListener('click', async () => {
  cfg = await window.api.saveConfig(kumpulkan());
  isiForm();
  status('✓ Tersimpan');
});
$('#closeBtn').addEventListener('click', () => window.close());
document.addEventListener('keydown', e => { if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); $('#saveBtn').click(); } });

$('#resetBtn').addEventListener('click', async () => {
  if (!confirm('Kembalikan semua pengaturan ke bawaan? Jadwal yang sudah diisi akan hilang.')) return;
  cfg = await window.api.saveConfig(await window.api.getDefault());
  isiForm(); status('Dikembalikan ke bawaan');
});
$('#folderBtn').addEventListener('click', () => window.api.openConfigFolder());
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(kumpulkan(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dynamic-island-pengaturan.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    cfg = await window.api.saveConfig(data);
    isiForm(); status('✓ Pengaturan diimpor');
  } catch { alert('File tidak valid.'); }
  e.target.value = '';
});

// ---------- Sholat & posisi ----------
function tampilSholat() {
  const lat = Number($('#sh-lat').value), lon = Number($('#sh-lon').value);
  if (!isFinite(lat) || !isFinite(lon)) { $('#sh-hariini').textContent = 'Koordinat tidak valid.'; return; }
  const w = Bersama.waktuSholat(new Date(), lat, lon, 7);
  $('#sh-hariini').textContent = [['imsak', 'Imsak'], ...Bersama.NAMA_SHOLAT].map(([k, n]) => `${n} ${Bersama.fmtMin(w[k])}`).join(' · ');
}
['sh-lat', 'sh-lon'].forEach(id => $('#' + id).addEventListener('input', tampilSholat));
$('#sh-bawaan').addEventListener('click', () => { setVal('sh-lat', SH_BAWAAN.lat); setVal('sh-lon', SH_BAWAAN.lon); tampilSholat(); });
$('#wg-reset').addEventListener('click', () => window.api.widgetReset());
$('#wg-100').addEventListener('click', () => window.api.widgetSkala100());
$('#cu-samakan').addEventListener('click', () => { setVal('cu-lat', getVal('sh-lat')); setVal('cu-lon', getVal('sh-lon')); });
$('#resetPosisi').addEventListener('click', () => { window.api.resetPosisi(); status('Pil dikembalikan ke tengah atas'); });

// ---------- Pembaruan ----------
function tampilUpdate(u) {
  if (!u) return;
  const t = {
    dev: `Versi ${u.versi} (mode pengembangan lewat npm start — pembaruan otomatis hanya aktif pada versi .exe yang terpasang).`,
    idle: `Versi ${u.versi}.`, memeriksa: `Versi ${u.versi} · memeriksa pembaruan…`, terbaru: `Versi ${u.versi} · ✓ sudah yang terbaru.`,
    mengunduh: `Versi ${u.versi} · mengunduh versi ${u.baru}… ${u.persen}%`, siap: `Versi ${u.versi} · versi ${u.baru} siap dipasang.`,
    galat: `Versi ${u.versi} · gagal memeriksa pembaruan (${esc(u.galat)}).`
  }[u.status] || `Versi ${u.versi}.`;
  $('#upInfo').innerHTML = t;
  $('#upPasang').hidden = u.status !== 'siap';
}
window.api.versi().then(tampilUpdate);
window.api.onUpdate(tampilUpdate);
$('#upPeriksa').addEventListener('click', () => window.api.periksaUpdate());
$('#upPasang').addEventListener('click', () => window.api.pasangUpdate());

// ---------- BukuKelas ----------
function tampilBk() {
  const el = $('#bkStatus');
  if (!bkSt || !bkSt.siapKonfig) { el.innerHTML = 'Project URL / anon key belum diisi.'; return; }
  if (!bkSt.masuk) { el.innerHTML = '<b>Belum masuk.</b> Klik <b>Buka Panel Kelas</b> lalu masuk dengan akun BukuKelas.'; $('#bkKeluar').hidden = true; return; }
  $('#bkKeluar').hidden = false;
  const d = bkSt.data;
  el.innerHTML = `<b style="color:var(--acc)">✓ Tersambung</b> sebagai ${esc(bkSt.email)}` +
    (d ? `<div class="sum">Kelas ${esc(d.kelas)} · ${esc(d.semNama)} · ${d.siswa.length} siswa · ${d.struktur.length} mapel</div>` : '') +
    (bkSt.antrean ? `<div class="sum">${bkSt.antrean} perubahan menunggu terkirim.</div>` : '') +
    (bkSt.galat ? `<div class="sum" style="color:#b4493c">${esc(bkSt.galat)}</div>` : '');
}
$('#bkPanel').addEventListener('click', () => window.api.openKelas({}));
$('#bkMuat').addEventListener('click', async () => { await window.api.bk.muat(); });
$('#bkKeluar').addEventListener('click', async () => { if (confirm('Keluar dari BukuKelas di laptop ini?')) await window.api.bk.keluar(); });
window.api.bk.onStatus(s => {
  const tadi = bkStruktur().length;
  bkSt = s; tampilBk();
  if (cfg && bkStruktur().length !== tadi) $$('#jadwalBody tr').forEach(isiBk);
});

window.api.getConfig().then(c => { cfg = structuredClone(c); isiForm(); });
window.api.bk.status()
  .then(s => { bkSt = s; tampilBk(); if (cfg) $$('#jadwalBody tr').forEach(isiBk); })
  .catch(() => { $('#bkStatus').innerHTML = '<b style="color:#b4493c">Aplikasi versi lama masih berjalan.</b> Klik kanan ikon Dynamic Island di system tray → Keluar, lalu jalankan <code>npm start</code> lagi.'; });
