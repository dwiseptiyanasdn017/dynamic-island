'use strict';
/*
 * Jembatan ke BukuKelas (Supabase).
 * Format data mengikuti app.js BukuKelas apa adanya:
 *  - nh_struktur.data      : array (semester dasar) atau {sem:{<idSem>:[mapel...]}}
 *  - nh_siswa              : id, nama, urut
 *  - nh_nilai              : mapel_id = <idMapel> (semester dasar "2026-1") atau "<idSem>|<idMapel>"
 *                            kunci    = tp:<idTP> | ptp:<idTP> | mt:<idMateri> | pmt:<idMateri> | sas | rem
 *                            presensi : mapel_id "_absen", kunci "YYYY-MM-DD", nilai 1=S 2=I 3=A (null = hadir)
 *  - nh_catatan            : jurnal  -> siswa_id "_jurnal", kunci "YYYY-MM-DD|j<uid>", teks JSON
 *                            panggilan -> siswa_id <id>, kunci "panggilan"
 *                            biodata   -> siswa_id <id>, kunci "biodata", teks JSON (dibaca: tgl = tanggal lahir)
 * Hanya baris nilai/catatan yang ditulis; nh_struktur dan nh_siswa tidak pernah diubah dari sini.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SEM_DASAR = '2026-1';
const ABSEN_ID = '_absen';
const JURNAL = '_jurnal';
const IDENT_DEFAULT = { kelas: '2C', semester: 'Semester 1 TA 2026/2027', kktp: 75 };

const tglStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const namaRapi = n => String(n).toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());
const uidBaru = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function normStruktur(d) {
  if (Array.isArray(d)) return { [SEM_DASAR]: d };
  if (d && d.sem && typeof d.sem === 'object') return { ...d.sem };
  return {};
}

class BukuKelas {
  /**
   * @param {object} o
   * @param {string} o.url        Supabase Project URL
   * @param {string} o.anonKey    anon public key
   * @param {string} o.dir        folder untuk sesi & antrean offline
   * @param {{encrypt:(s:string)=>Buffer, decrypt:(b:Buffer)=>string}|null} o.crypt  penyandi sesi (safeStorage)
   * @param {(ev:string, data:any)=>void} o.emit
   */
  constructor({ url, anonKey, dir, crypt = null, emit = () => {} }) {
    this.dir = dir;
    this.crypt = crypt;
    this.emit = emit;
    this.user = null;
    this.data = null;          // ringkasan untuk antarmuka
    this.antrian = this._bacaJSON('bk-antrian.json', []);
    this.lastErr = null;
    this.sedangKirim = false;
    this.url = url;
    this.anonKey = anonKey;
    this.sb = null;
    if (url && anonKey) this._buatKlien();
  }

  // ---------- penyimpanan lokal ----------
  _file(n) { return path.join(this.dir, n); }
  _bacaJSON(n, def) { try { return JSON.parse(fs.readFileSync(this._file(n), 'utf8')); } catch { return def; } }
  _tulisJSON(n, v) { fs.mkdirSync(this.dir, { recursive: true }); fs.writeFileSync(this._file(n), JSON.stringify(v)); }
  _storage() {
    // Penyimpanan sesi asinkron: isi dibaca sekali ke memori, lalu ditulis (terenkripsi) setiap berubah.
    const f = this._file('bk-sesi.bin');
    let isi = null, antre = Promise.resolve();
    const muat = async () => {
      if (isi) return isi;
      try {
        const b = fs.readFileSync(f);
        const s = this.crypt ? await this.crypt.decrypt(b) : b.toString('utf8');
        isi = JSON.parse(s);
      } catch { isi = {}; } // sesi lama/rusak: cukup masuk ulang sekali
      return isi;
    };
    const tulis = () => {
      antre = antre.then(async () => {
        fs.mkdirSync(this.dir, { recursive: true });
        const s = JSON.stringify(isi);
        fs.writeFileSync(f, this.crypt ? await this.crypt.encrypt(s) : s);
      }).catch(() => {});
      return antre;
    };
    return {
      getItem: async k => (await muat())[k] ?? null,
      setItem: async (k, v) => { (await muat())[k] = v; await tulis(); },
      removeItem: async k => { delete (await muat())[k]; await tulis(); }
    };
  }
  _buatKlien() {
    this.sb = createClient(this.url, this.anonKey, {
      auth: { storage: this._storage(), persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 2 } }
    });
  }
  setKonfigurasi(url, anonKey) {
    if (url === this.url && anonKey === this.anonKey) return;
    this.url = url; this.anonKey = anonKey; this.sb = null; this.user = null; this.data = null;
    if (url && anonKey) this._buatKlien();
  }

  // ---------- status & sesi ----------
  status() {
    return {
      siapKonfig: !!this.sb,
      masuk: !!this.user,
      email: this.user ? this.user.email : '',
      antrean: this.antrian.length,
      galat: this.lastErr ? String(this.lastErr.message || this.lastErr) : '',
      data: this.data
    };
  }
  _kabar() { this.emit('bk:status', this.status()); }

  async mulai() {
    if (!this.sb) return this._kabar();
    try {
      const { data } = await this.sb.auth.getSession();
      this.user = data.session ? data.session.user : null;
      if (this.user) { await this.kirimAntrean(); await this.muat(); }
    } catch (e) { this.lastErr = e; }
    this._kabar();
  }
  async masuk(email, password) {
    if (!this.sb) throw new Error('Alamat Supabase BukuKelas belum diisi.');
    const { data, error } = await this.sb.auth.signInWithPassword({ email: String(email).trim(), password });
    if (error) throw new Error(/invalid/i.test(error.message) ? 'Email atau kata sandi salah.' : error.message);
    this.user = data.user;
    this.lastErr = null;
    await this.muat();
    this._kabar();
    return this.status();
  }
  async keluar() {
    try { if (this.sb) await this.sb.auth.signOut(); } catch { /* tetap keluar lokal */ }
    this.user = null; this.data = null;
    try { fs.unlinkSync(this._file('bk-sesi.bin')); } catch { /* tidak ada */ }
    this._kabar();
  }

  // ---------- membaca ----------
  async muat(tgl = tglStr(new Date())) {
    if (!this.sb || !this.user) return null;
    try {
      const st = await this.sb.from('nh_struktur').select('data,identitas').maybeSingle();
      if (st.error) throw st.error;
      const sw = await this.sb.from('nh_siswa').select('id,nama,urut').order('urut').order('id');
      if (sw.error) throw sw.error;
      const pg = await this.sb.from('nh_catatan').select('siswa_id,kunci,teks').in('kunci', ['panggilan', 'biodata']);
      const panggilan = {}, lahir = {};
      if (!pg.error) pg.data.forEach(r => {
        if (r.kunci === 'panggilan') panggilan[r.siswa_id] = r.teks;
        else { try { const b = JSON.parse(r.teks || '{}') || {}; if (/^\d{4}-\d{2}-\d{2}$/.test(b.tgl || '')) lahir[r.siswa_id] = b.tgl; } catch { /* biodata rusak diabaikan */ } }
      });

      const identitas = { ...IDENT_DEFAULT, ...((st.data && st.data.identitas) || {}) };
      const peta = normStruktur(st.data && st.data.data);
      const semList = Array.isArray(identitas.semList) && identitas.semList.length
        ? identitas.semList : [{ id: SEM_DASAR, nama: identitas.semester || 'Semester 1 TA 2026/2027' }];
      const semId = semList.find(x => x.id === identitas.semAktif) ? identitas.semAktif : semList[semList.length - 1].id;
      const semNama = (semList.find(x => x.id === semId) || {}).nama || '';
      const presensiCfg = (semId === SEM_DASAR ? identitas.presensi : ((identitas.semCfg || {})[semId] || {}).presensi) || {};

      const siswa = sw.data
        .map(s => ({ id: s.id, nama: s.nama, urut: s.urut, lengkap: namaRapi(String(s.nama).trim().replace(/\s+/g, ' ')), panggilan: panggilan[s.id] || namaRapi(String(s.nama).trim().split(/\s+/)[0] || ''), lahir: lahir[s.id] || '' }))
        .sort((a, b) => (a.urut - b.urut) || a.nama.localeCompare(b.nama));

      const struktur = (peta[semId] || []).map(m => ({
        id: m.id, nama: m.nama, warna: Number(m.warna) || 0,
        materi: (m.materi || []).map(mt => ({ id: mt.id, nama: mt.nama, tp: (mt.tp || []).map(t => ({ id: t.id, nama: t.nama })) }))
      }));

      this.data = {
        kelas: identitas.kelas || '',
        kktp: Number(identitas.kktp) || 75,
        semId, semNama,
        presensi: {
          awal: presensiCfg.awal || '2026-07-13',
          akhir: presensiCfg.akhir || '2026-12-19',
          libur: Array.isArray(presensiCfg.libur) ? presensiCfg.libur : [],
          masuk: Array.isArray(presensiCfg.masuk) ? presensiCfg.masuk : []
        },
        struktur,
        siswa,
        tgl,
        absen: await this.absen(tgl),
        diperbarui: Date.now()
      };
      this.lastErr = null;
    } catch (e) {
      this.lastErr = e;
      if (/JWT|401|refresh/i.test(String(e.message))) { this.user = null; }
    }
    this._kabar();
    return this.data;
  }

  _mk(mapelId) { return (!this.data || this.data.semId === SEM_DASAR) ? mapelId : `${this.data.semId}|${mapelId}`; }

  async absen(tgl) {
    const out = {};
    const r = await this.sb.from('nh_nilai').select('siswa_id,nilai').eq('mapel_id', ABSEN_ID).eq('kunci', tgl);
    if (r.error) throw r.error;
    r.data.forEach(x => { if (x.nilai) out[x.siswa_id] = x.nilai; });
    this._timpaAntrean(out, o => o.t === 'n' && o.mapel_id === ABSEN_ID && o.kunci === tgl, o => o.siswa_id);
    return out;
  }

  /** Nilai satu mapel: { [siswaId]: { [kunci]: nilai } } */
  async nilaiMapel(mapelId) {
    const mid = this._mk(mapelId), out = {};
    for (let from = 0; ; from += 1000) {
      const r = await this.sb.from('nh_nilai').select('siswa_id,kunci,nilai').eq('mapel_id', mid).range(from, from + 999);
      if (r.error) throw r.error;
      r.data.forEach(x => { if (x.nilai !== null) (out[x.siswa_id] = out[x.siswa_id] || {})[x.kunci] = x.nilai; });
      if (r.data.length < 1000) break;
    }
    for (const o of this.antrian) {
      if (o.t === 'n' && o.mapel_id === mid) {
        const s = out[o.siswa_id] = out[o.siswa_id] || {};
        if (o.nilai === null) delete s[o.kunci]; else s[o.kunci] = o.nilai;
      }
    }
    return out;
  }

  async jurnal(tgl) {
    const r = await this.sb.from('nh_catatan').select('kunci,teks').eq('siswa_id', JURNAL).like('kunci', `${tgl}|%`);
    if (r.error) throw r.error;
    const map = {};
    r.data.forEach(x => { map[x.kunci] = x.teks; });
    for (const o of this.antrian) if (o.t === 'c' && o.siswa_id === JURNAL && o.kunci.startsWith(tgl + '|')) {
      if (o.teks === null) delete map[o.kunci]; else map[o.kunci] = o.teks;
    }
    return Object.entries(map).map(([k, v]) => { try { return { k, ...JSON.parse(v) }; } catch { return null; } })
      .filter(Boolean).sort((a, b) => String(a.jp || '').padStart(5, '0').localeCompare(String(b.jp || '').padStart(5, '0')) || a.k.localeCompare(b.k));
  }

  _timpaAntrean(out, cocok, kunciOf) {
    for (const o of this.antrian) if (cocok(o)) { if (o.nilai) out[kunciOf(o)] = o.nilai; else delete out[kunciOf(o)]; }
  }

  // ---------- menulis (lewat antrean agar aman saat internet putus) ----------
  _antre(op) {
    const key = op.t === 'n' ? `n|${op.siswa_id}|${op.mapel_id}|${op.kunci}` : `c|${op.siswa_id}|${op.kunci}`;
    this.antrian = this.antrian.filter(o => o.key !== key);
    this.antrian.push({ ...op, key });
    this._tulisJSON('bk-antrian.json', this.antrian);
    this._kabar();
    return this.kirimAntrean();
  }

  setAbsen(siswaId, tgl, v) {
    const nilai = [1, 2, 3].includes(Number(v)) ? Number(v) : null;
    if (this.data && this.data.tgl === tgl) { if (nilai) this.data.absen[siswaId] = nilai; else delete this.data.absen[siswaId]; }
    return this._antre({ t: 'n', siswa_id: siswaId, mapel_id: ABSEN_ID, kunci: tgl, nilai });
  }

  setNilai(siswaId, mapelId, kunci, v) {
    if (!/^(tp|ptp|mt|pmt):.+|^(sas|rem)$/.test(kunci)) throw new Error('Kunci nilai tidak dikenal: ' + kunci);
    let nilai = v === '' || v === null || v === undefined ? null : Math.round(Number(v));
    if (nilai !== null && (isNaN(nilai) || nilai < 0 || nilai > 100)) throw new Error('Nilai harus 0–100.');
    return this._antre({ t: 'n', siswa_id: siswaId, mapel_id: this._mk(mapelId), kunci, nilai });
  }

  /** j: {k?, tgl, mapel, materi, tp:[], jp, kegiatan, catatan} */
  simpanJurnal(j) {
    const s = this.data && this.data.struktur || [];
    const m = s.find(x => x.id === j.mapel);
    if (!m) throw new Error('Pilih mata pelajaran dulu.');
    const mt = m.materi.find(x => x.id === j.materi);
    const tp = Array.isArray(j.tp) ? j.tp : [];
    const data = {
      mapel: m.id, mapelNama: m.nama,
      materi: mt ? mt.id : '', materiNama: mt ? mt.nama : '',
      tp, tpNama: mt ? mt.tp.filter(x => tp.includes(x.id)).map(x => x.nama) : [],
      jp: String(j.jp || '').trim(), kegiatan: String(j.kegiatan || '').trim(), catatan: String(j.catatan || '').trim()
    };
    const kunci = j.k || `${j.tgl}|${uidBaru('j')}`;
    return this._antre({ t: 'c', siswa_id: JURNAL, kunci, teks: JSON.stringify(data) }).then(() => kunci);
  }
  hapusJurnal(k) { return this._antre({ t: 'c', siswa_id: JURNAL, kunci: k, teks: null }); }

  async kirimAntrean() {
    if (!this.sb || !this.user || this.sedangKirim || !this.antrian.length) return;
    this.sedangKirim = true;
    const kirim = [...this.antrian];
    const selesai = new Set();
    try {
      const nl = kirim.filter(o => o.t === 'n');
      for (let i = 0; i < nl.length; i += 500) {
        const part = nl.slice(i, i + 500);
        const { error } = await this.sb.from('nh_nilai').upsert(
          part.map(o => ({ owner_id: this.user.id, siswa_id: o.siswa_id, mapel_id: o.mapel_id, kunci: o.kunci, nilai: o.nilai })),
          { onConflict: 'owner_id,siswa_id,mapel_id,kunci' });
        if (error) throw error;
        part.forEach(o => selesai.add(o));
      }
      for (const o of kirim.filter(x => x.t === 'c')) {
        const r = o.teks === null
          ? await this.sb.from('nh_catatan').delete().eq('siswa_id', o.siswa_id).eq('kunci', o.kunci)
          : await this.sb.from('nh_catatan').upsert({ owner_id: this.user.id, siswa_id: o.siswa_id, kunci: o.kunci, teks: o.teks }, { onConflict: 'owner_id,siswa_id,kunci' });
        if (r.error) throw r.error;
        selesai.add(o);
      }
      this.lastErr = null;
    } catch (e) {
      this.lastErr = e;
    } finally {
      // buang yang terkirim, kecuali sudah ditimpa perubahan yang lebih baru
      this.antrian = this.antrian.filter(o => !selesai.has(o));
      this._tulisJSON('bk-antrian.json', this.antrian);
      this.sedangKirim = false;
      this._kabar();
    }
  }
}

module.exports = { BukuKelas, tglStr, SEM_DASAR, ABSEN_ID, JURNAL };
