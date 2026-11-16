'use strict';
const B = window.Bersama;
const bk = window.api.bk;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = B.esc;
const KODE = { 1: 'S', 2: 'I', 3: 'A' };

let st = null;           // status BukuKelas
let cfg = null;          // konfigurasi pulau (untuk jadwal)
let tab = 'presensi';
const absCache = {};     // tgl -> {sid: v}
const nilaiCache = {};   // mapelId -> {sid: {kunci: nilai}}
let jurnalEdit = null;   // kunci jurnal yang sedang diubah
const acak = { sudah: [] };

const D = () => (st && st.data) || null;
const siswa = () => (D() ? D().siswa : []);
const struktur = () => (D() ? D().struktur : []);
const hariIni = () => B.tglStr(new Date());

async function panggil(p) {
  const r = await p;
  if (!r.ok) throw new Error(r.galat);
  return r.hasil;
}
function pesan(el, teks, galat) { el.textContent = teks; el.className = galat ? 'err' : 'ok'; if (!galat) setTimeout(() => { if (el.textContent === teks) el.textContent = ''; }, 2500); }

// ---------- Status & login ----------
function tampilStatus() {
  const masuk = st && st.masuk;
  $('#login').hidden = masuk;
  $('#tabs').hidden = !masuk;
  $$('.pane').forEach(p => { p.style.display = masuk ? '' : 'none'; });
  $('#btnMuat').hidden = !masuk;
  const s = $('#sync');
  if (!masuk) { $('#info').textContent = ''; s.hidden = true; return; }
  s.hidden = false;
  const d = D();
  $('#info').textContent = d ? `Kelas ${d.kelas} · ${d.semNama} · ${d.siswa.length} siswa · ${st.email}` : st.email;
  if (st.galat) { s.dataset.s = 'err'; $('#syncTeks').textContent = st.antrean ? `Belum terkirim (${st.antrean}) — akan dicoba lagi` : 'Gagal terhubung'; s.title = st.galat; }
  else if (st.antrean) { s.dataset.s = 'wait'; $('#syncTeks').textContent = `Mengirim ${st.antrean} perubahan…`; s.title = ''; }
  else { s.dataset.s = 'ok'; $('#syncTeks').textContent = 'Tersinkron dengan BukuKelas'; s.title = ''; }
}
$('#btnMasuk').addEventListener('click', async () => {
  $('#loginErr').textContent = '';
  $('#btnMasuk').disabled = true; $('#btnMasuk').textContent = 'Masuk…';
  try {
    st = await panggil(bk.masuk($('#em').value, $('#pw').value));
    $('#pw').value = '';
    tampilStatus(); semua();
  } catch (e) { $('#loginErr').textContent = e.message; }
  $('#btnMasuk').disabled = false; $('#btnMasuk').textContent = 'Masuk';
});
$('#pw').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnMasuk').click(); });
$('#btnMuat').addEventListener('click', async () => {
  Object.keys(absCache).forEach(k => delete absCache[k]);
  Object.keys(nilaiCache).forEach(k => delete nilaiCache[k]);
  try { await panggil(bk.muat()); } catch (e) { alert(e.message); }
  st = await bk.status(); tampilStatus(); semua();
});

// ---------- Tab ----------
function bukaTab(t) {
  tab = t;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $$('.pane').forEach(p => p.classList.toggle('on', p.id === 'p-' + t));
  semua();
}
$$('#tabs button').forEach(b => b.addEventListener('click', () => bukaTab(b.dataset.t)));

function semua() {
  if (!st || !st.masuk || !D()) return;
  if (tab === 'presensi') renderPresensi();
  if (tab === 'nilai') renderNilaiPilihan();
  if (tab === 'jurnal') renderJurnal();
  if (tab === 'acak') renderAcakInfo();
}

// ---------- Presensi ----------
async function ambilAbsen(tgl, segar = false) {
  if (!segar && absCache[tgl]) return absCache[tgl];
  if (!segar && D() && D().tgl === tgl) return (absCache[tgl] = { ...D().absen });
  return (absCache[tgl] = await panggil(bk.absen(tgl)));
}
async function renderPresensi() {
  const tgl = $('#absTgl').value || hariIni();
  $('#absTgl').value = tgl;
  const info = B.infoHari(tgl, D().presensi);
  $('#absLibur').textContent = `${B.tglPanjang(tgl)}${info.sekolah ? '' : ' · Libur: ' + info.alasan}`;
  let ab;
  try { ab = await ambilAbsen(tgl); } catch (e) { $('#absBody').innerHTML = `<tr><td class="err">${esc(e.message)}</td></tr>`; return; }
  const n = siswa().length, h = [0, 0, 0, 0];
  siswa().forEach(s => h[ab[s.id] || 0]++);
  $('#absRingkas').innerHTML = `<div><b>${h[0]}</b>hadir</div><div><b>${h[1]}</b>sakit</div><div><b>${h[2]}</b>izin</div><div><b style="color:${h[3] ? 'var(--merah)' : 'inherit'}">${h[3]}</b>alpa</div><div><b>${n}</b>siswa</div>`;
  $('#absBody').innerHTML = siswa().map((s, i) => {
    const v = ab[s.id] || 0;
    return `<tr><td class="no">${i + 1}</td><td>${esc(s.nama)}</td><td><div class="hsia" data-sid="${esc(s.id)}">
      ${['H', 'S', 'I', 'A'].map((l, k) => `<button data-v="${k}" class="${v === k ? 'on' : ''}" title="${['Hadir', 'Sakit', 'Izin', 'Alpa'][k]}">${l}</button>`).join('')}
    </div></td></tr>`;
  }).join('') || '<tr><td class="muted">Belum ada siswa di BukuKelas.</td></tr>';
}
$('#absBody').addEventListener('click', async e => {
  const b = e.target.closest('.hsia button'); if (!b) return;
  const sid = b.parentElement.dataset.sid, v = Number(b.dataset.v), tgl = $('#absTgl').value;
  const ab = absCache[tgl] || (absCache[tgl] = {});
  if (v) ab[sid] = v; else delete ab[sid];
  renderPresensi();
  try { await panggil(bk.setAbsen(sid, tgl, v)); } catch (err) { alert('Gagal menyimpan presensi: ' + err.message); }
});
$('#absTgl').addEventListener('change', renderPresensi);
$('#absHariIni').addEventListener('click', () => { $('#absTgl').value = hariIni(); renderPresensi(); });
$$('[data-geser]').forEach(b => b.addEventListener('click', () => {
  let d = B.keDate($('#absTgl').value || hariIni());
  for (let i = 0; i < 30; i++) {
    d.setDate(d.getDate() + Number(b.dataset.geser));
    if (B.infoHari(B.tglStr(d), D().presensi).sekolah) break;
  }
  $('#absTgl').value = B.tglStr(d); renderPresensi();
}));

// ---------- Nilai ----------
function isiSelect(el, items, nilai, kosong) {
  el.innerHTML = (kosong ? `<option value="">${kosong}</option>` : '') + items.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  if (nilai !== undefined && items.some(([v]) => v === nilai)) el.value = nilai;
}
function renderNilaiPilihan() {
  const sel = $('#nMapel'), lama = sel.value;
  isiSelect(sel, struktur().map(m => [m.id, m.nama]), lama);
  aturNilaiMateri();
}
function aturNilaiMateri() {
  const m = struktur().find(x => x.id === $('#nMapel').value);
  const jenis = $('#nJenis').value;
  const butuhMateri = ['tp', 'ptp', 'mt', 'pmt'].includes(jenis), butuhTp = ['tp', 'ptp'].includes(jenis);
  $('#nMateriWrap').style.visibility = butuhMateri ? '' : 'hidden';
  $('#nTpWrap').style.visibility = butuhTp ? '' : 'hidden';
  const lamaM = $('#nMateri').value;
  isiSelect($('#nMateri'), (m ? m.materi : []).map((x, i) => [x.id, `Materi ${i + 1}: ${x.nama}`]), lamaM);
  const mt = m && m.materi.find(x => x.id === $('#nMateri').value);
  const lamaT = $('#nTp').value;
  isiSelect($('#nTp'), (mt ? mt.tp : []).map((x, i) => [x.id, `TP${i + 1}: ${x.nama}`]), lamaT);
  renderNilai();
}
function kunciNilai() {
  const j = $('#nJenis').value;
  if (j === 'sas' || j === 'rem') return { kunci: j, acuan: j === 'rem' ? 'sas' : null };
  if (j === 'tp' || j === 'ptp') { const t = $('#nTp').value; return t ? { kunci: `${j}:${t}`, acuan: j === 'ptp' ? `tp:${t}` : null } : null; }
  const m = $('#nMateri').value; return m ? { kunci: `${j}:${m}`, acuan: j === 'pmt' ? `mt:${m}` : null } : null;
}
async function renderNilai() {
  const mapelId = $('#nMapel').value, k = kunciNilai();
  const body = $('#nBody');
  if (!mapelId || !k) { body.innerHTML = '<tr><td class="muted" colspan="4">Pilih mapel, materi, dan TP.</td></tr>'; $('#nKet').textContent = ''; return; }
  let data;
  try { data = nilaiCache[mapelId] || (nilaiCache[mapelId] = await panggil(bk.nilai(mapelId))); }
  catch (e) { body.innerHTML = `<tr><td class="err" colspan="4">${esc(e.message)}</td></tr>`; return; }
  const kktp = D().kktp;
  const terisi = siswa().filter(s => (data[s.id] || {})[k.kunci] !== undefined).length;
  $('#nKet').textContent = `KKTP ${kktp}. Terisi ${terisi} dari ${siswa().length} siswa. Nilai tersimpan otomatis ke BukuKelas saat pindah kolom atau menekan Enter.` + (k.acuan ? ' Kolom abu-abu = nilai asli sebagai acuan.' : '');
  body.innerHTML = siswa().map((s, i) => {
    const v = (data[s.id] || {})[k.kunci];
    const a = k.acuan ? (data[s.id] || {})[k.acuan] : undefined;
    return `<tr><td class="no">${i + 1}</td><td>${esc(s.nama)}</td>
      <td class="n"><input type="number" min="0" max="100" data-sid="${esc(s.id)}" value="${v ?? ''}" class="${v !== undefined && v < kktp ? 'kurang' : ''}"></td>
      <td class="st muted">${k.acuan ? (a !== undefined ? `asli ${a}` : 'asli –') : ''}</td></tr>`;
  }).join('') || '<tr><td class="muted" colspan="4">Belum ada siswa.</td></tr>';
}
['#nMapel', '#nJenis', '#nMateri'].forEach(s => $(s).addEventListener('change', aturNilaiMateri));
$('#nTp').addEventListener('change', renderNilai);
$('#nBody').addEventListener('change', async e => {
  const inp = e.target.closest('input[data-sid]'); if (!inp) return;
  const mapelId = $('#nMapel').value, k = kunciNilai(), sid = inp.dataset.sid;
  const raw = inp.value.trim();
  const v = raw === '' ? null : Math.round(Number(raw));
  if (v !== null && (isNaN(v) || v < 0 || v > 100)) { alert('Nilai harus 0–100.'); inp.value = ''; return; }
  const d = nilaiCache[mapelId] = nilaiCache[mapelId] || {};
  const s = d[sid] = d[sid] || {};
  if (v === null) delete s[k.kunci]; else s[k.kunci] = v;
  inp.value = v ?? '';
  inp.classList.toggle('kurang', v !== null && v < D().kktp);
  const terisi = siswa().filter(x => (d[x.id] || {})[k.kunci] !== undefined).length;
  $('#nKet').textContent = $('#nKet').textContent.replace(/Terisi \d+ dari/, `Terisi ${terisi} dari`);
  try {
    await panggil(bk.setNilai(sid, mapelId, k.kunci, v));
    inp.classList.add('simpan'); setTimeout(() => inp.classList.remove('simpan'), 900);
  } catch (err) { alert('Gagal menyimpan nilai: ' + err.message); }
});
$('#nBody').addEventListener('keydown', e => {
  if (!e.target.matches('input[data-sid]')) return;
  if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const all = $$('#nBody input[data-sid]'), i = all.indexOf(e.target);
    const n = all[i + (e.key === 'ArrowUp' ? -1 : 1)];
    e.target.dispatchEvent(new Event('change', { bubbles: true }));
    if (n) { n.focus(); n.select(); }
  }
});

// ---------- Jurnal ----------
function isiJurnalMapel(mapelId) {
  isiSelect($('#jMapel'), struktur().map(m => [m.id, m.nama]), mapelId, 'Pilih mapel');
  isiJurnalMateri();
}
function isiJurnalMateri(materiId, tpTerpilih = []) {
  const m = struktur().find(x => x.id === $('#jMapel').value);
  isiSelect($('#jMateri'), (m ? m.materi : []).map((x, i) => [x.id, `Materi ${i + 1}: ${x.nama}`]), materiId, m && m.materi.length ? 'Pilih materi' : 'Belum ada materi');
  isiJurnalTp(tpTerpilih);
}
function isiJurnalTp(terpilih = []) {
  const m = struktur().find(x => x.id === $('#jMapel').value);
  const mt = m && m.materi.find(x => x.id === $('#jMateri').value);
  $('#jTp').innerHTML = mt && mt.tp.length
    ? mt.tp.map((x, i) => `<label><input type="checkbox" value="${esc(x.id)}" ${terpilih.includes(x.id) ? 'checked' : ''}> TP${i + 1}: ${esc(x.nama)}</label>`).join('')
    : '<span class="muted small">Pilih materi dulu.</span>';
}
$('#jMapel').addEventListener('change', () => isiJurnalMateri());
$('#jMateri').addEventListener('change', () => isiJurnalTp());

function kosongkanForm() {
  jurnalEdit = null;
  $('#jJudul').textContent = 'Jurnal baru';
  $('#jBatal').hidden = true;
  ['#jJp', '#jKeg', '#jCat'].forEach(s => { $(s).value = ''; });
  isiJurnalMapel('');
}
async function renderJurnal() {
  const tgl = $('#jTgl').value || hariIni();
  $('#jTgl').value = tgl;
  if (!$('#jMapel').options.length) isiJurnalMapel('');
  try {
    const ab = await ambilAbsen(tgl);
    const tidak = siswa().filter(s => ab[s.id]).map(s => `${s.lengkap} (${KODE[ab[s.id]]})`);
    $('#jAbsen').textContent = `${B.tglPanjang(tgl)} · Tidak hadir: ${tidak.length ? tidak.join(', ') : 'semua hadir'}`;
    const list = await panggil(bk.jurnal(tgl));
    $('#jList').innerHTML = list.length ? list.map(j => `<div class="jurnal-item">
        <div class="row"><b>${esc(j.mapelNama)}</b>${j.jp ? `<span class="muted small">JP ${esc(j.jp)}</span>` : ''}
          <span style="margin-left:auto"></span>
          <button class="b kecil" data-ubah="${esc(j.k)}">Ubah</button><button class="b kecil" data-hapus="${esc(j.k)}">Hapus</button></div>
        ${j.materiNama ? `<div class="small"><b>Materi:</b> ${esc(j.materiNama)}</div>` : ''}
        ${(j.tpNama || []).length ? `<ul class="small" style="margin:4px 0">${j.tpNama.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        ${j.kegiatan ? `<div class="small"><b>Kegiatan:</b> ${esc(j.kegiatan)}</div>` : ''}
        ${j.catatan ? `<div class="small"><b>Catatan:</b> ${esc(j.catatan)}</div>` : ''}
      </div>`).join('') : '<span class="muted small">Belum ada jurnal untuk tanggal ini.</span>';
    $('#jList').__data = list;
  } catch (e) { $('#jList').innerHTML = `<span class="err">${esc(e.message)}</span>`; }
}
$('#jTgl').addEventListener('change', () => { kosongkanForm(); renderJurnal(); });
$('#jBatal').addEventListener('click', kosongkanForm);
$('#jList').addEventListener('click', async e => {
  const list = $('#jList').__data || [];
  const u = e.target.dataset.ubah, h = e.target.dataset.hapus;
  if (u) {
    const j = list.find(x => x.k === u); if (!j) return;
    jurnalEdit = j.k;
    $('#jJudul').textContent = 'Ubah jurnal';
    $('#jBatal').hidden = false;
    isiSelect($('#jMapel'), struktur().map(m => [m.id, m.nama]), j.mapel, 'Pilih mapel');
    isiJurnalMateri(j.materi, j.tp || []);
    $('#jJp').value = j.jp || ''; $('#jKeg').value = j.kegiatan || ''; $('#jCat').value = j.catatan || '';
    $('#jMapel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (h) {
    if (!confirm('Hapus jurnal ini dari BukuKelas?')) return;
    try { await panggil(bk.hapusJurnal(h)); if (jurnalEdit === h) kosongkanForm(); renderJurnal(); }
    catch (err) { alert(err.message); }
  }
});
$('#jSimpan').addEventListener('click', async () => {
  const j = {
    k: jurnalEdit || undefined,
    tgl: $('#jTgl').value || hariIni(),
    mapel: $('#jMapel').value,
    materi: $('#jMateri').value,
    tp: $$('#jTp input:checked').map(x => x.value),
    jp: $('#jJp').value, kegiatan: $('#jKeg').value, catatan: $('#jCat').value
  };
  if (!j.mapel) { pesan($('#jPesan'), 'Pilih mata pelajaran dulu.', true); return; }
  try {
    await panggil(bk.simpanJurnal(j));
    pesan($('#jPesan'), '✓ Tersimpan ke BukuKelas');
    kosongkanForm(); renderJurnal();
  } catch (e) { pesan($('#jPesan'), e.message, true); }
});

// ---------- Acak & kelompok ----------
async function hadirHariIni() {
  const ab = await ambilAbsen(hariIni());
  return siswa().filter(s => !ab[s.id]);
}
async function renderAcakInfo() {
  const hadir = await hadirHariIni();
  const pool = ($('#acakHadir').checked ? hadir : siswa()).filter(s => !acak.sudah.includes(s.id));
  $('#acakInfo').textContent = `· ${pool.length} siswa belum terpilih pada putaran ini`;
  $('#acakSudah').textContent = acak.sudah.length ? 'Sudah terpilih: ' + acak.sudah.map(id => (siswa().find(s => s.id === id) || {}).lengkap).filter(Boolean).join(', ') : '';
}
$('#acakBtn').addEventListener('click', async () => {
  const hadir = await hadirHariIni();
  let pool = ($('#acakHadir').checked ? hadir : siswa()).filter(s => !acak.sudah.includes(s.id));
  if (!pool.length) { acak.sudah = []; pool = $('#acakHadir').checked ? hadir : siswa(); }
  if (!pool.length) return;
  const el = $('#acakNama'); el.classList.add('putar');
  $('#acakBtn').disabled = true;
  const pilih = pool[Math.floor(Math.random() * pool.length)];
  for (let i = 0; i < 14; i++) {
    el.textContent = pool[Math.floor(Math.random() * pool.length)].lengkap;
    await new Promise(r => setTimeout(r, 40 + i * 12));
  }
  el.textContent = pilih.lengkap; el.classList.remove('putar');
  acak.sudah.push(pilih.id);
  $('#acakBtn').disabled = false;
  renderAcakInfo();
});
$('#acakReset').addEventListener('click', () => { acak.sudah = []; $('#acakNama').textContent = '—'; renderAcakInfo(); });
$('#acakHadir').addEventListener('change', renderAcakInfo);

let teksKelompok = '';
$('#kBtn').addEventListener('click', async () => {
  const hadir = await hadirHariIni();
  const arr = [...hadir];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  const angka = Math.max(1, Number($('#kAngka').value) || 2);
  // 'isi': sisa siswa disebar ke kelompok yang ada (19 siswa, isi 2 -> 9 kelompok, satu berisi 3)
  const jml = $('#kMode').value === 'jumlah' ? Math.min(angka, arr.length) : Math.max(1, Math.floor(arr.length / angka));
  const grup = Array.from({ length: jml }, () => []);
  arr.forEach((s, i) => grup[i % jml].push(s));
  $('#kHasil').innerHTML = grup.map((g, i) => `<div class="card"><h3>Kelompok ${i + 1}</h3><ol>${g.map(s => `<li>${esc(s.lengkap)}</li>`).join('')}</ol></div>`).join('');
  teksKelompok = grup.map((g, i) => `Kelompok ${i + 1}: ${g.map(s => s.lengkap).join(', ')}`).join('\n');
  $('#kSalin').hidden = !grup.length;
});
$('#kSalin').addEventListener('click', () => { navigator.clipboard.writeText(teksKelompok); $('#kSalin').textContent = 'Tersalin ✓'; setTimeout(() => { $('#kSalin').textContent = 'Salin teks'; }, 1500); });

// ---------- Dibuka dari pulau dengan tujuan tertentu ----------
let argTunda = null;
function terapkanArg(a) {
  if (!a || !a.tab) return;
  if (!D()) { argTunda = a; return; }
  argTunda = null;
  bukaTab(a.tab);
  if (a.tab === 'jurnal') {
    $('#jTgl').value = a.tgl || hariIni();
    kosongkanForm();
    if (a.mapel) isiJurnalMapel(a.mapel);
    if (a.jp) $('#jJp').value = a.jp;
    renderJurnal();
    setTimeout(() => $('#jMateri').focus(), 50);
  }
  if (a.tab === 'nilai' && a.mapel) { $('#nMapel').value = a.mapel; aturNilaiMateri(); }
}
window.api.onKelasBuka(terapkanArg);
window.api.onConfig(c => { cfg = c; B.setKaldik(c.kaldik); });
bk.onStatus(s => {
  const lamaData = D() && D().diperbarui;
  st = s; tampilStatus();
  if (argTunda && D()) { terapkanArg(argTunda); return; }
  if (D() && D().diperbarui !== lamaData) {
    if (D().tgl) absCache[D().tgl] = { ...D().absen };
    if (!document.activeElement || !document.activeElement.matches('input,textarea,select')) semua();
  }
});

(async function mulai() {
  cfg = await window.api.getConfig();
  B.setKaldik(cfg.kaldik);
  st = await bk.status();
  $('#absTgl').value = hariIni();
  $('#jTgl').value = hariIni();
  tampilStatus();
  semua();
  try {
    const q = new URLSearchParams(location.search).get('buka');
    if (q) terapkanArg(JSON.parse(q));
  } catch { /* abaikan */ }
})();
