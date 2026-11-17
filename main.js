const {
  app, BrowserWindow, ipcMain, screen, shell, Tray, Menu,
  globalShortcut, Notification, nativeImage, safeStorage, net
} = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const { BukuKelas } = require('./bukukelas');
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch { autoUpdater = null; }

// Ukuran jendela transparan (area maksimum pulau saat membesar).
const WIN_W = 520;
const WIN_H = 380;

let island = null;
let settingsWin = null;
let kelasWin = null;
const widgets = {};   // id kartu -> jendela widget
let bk = null;
let tray = null;
let mediaProc = null;
let config = null;
let quitting = false;
let kontrolProc = null;
let sembunyiManual = false;     // disembunyikan lewat Ctrl+Alt+D
let sembunyiPresentasi = false; // disembunyikan otomatis karena layar penuh
let anchor = { h: 'tengah', v: 'atas' };
let internet = { online: true, sejak: Date.now() };

const DEFAULT = JSON.parse(fs.readFileSync(path.join(__dirname, 'default-config.json'), 'utf8'));
const cfgPath = () => path.join(app.getPath('userData'), 'config.json');

// ---------- Konfigurasi ----------
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function merge(base, extra) {
  const out = { ...base };
  for (const k of Object.keys(extra || {})) {
    out[k] = isObj(base[k]) && isObj(extra[k]) && k !== 'jadwal' ? merge(base[k], extra[k]) : extra[k];
  }
  return out;
}
function loadConfig() {
  try {
    config = merge(structuredClone(DEFAULT), JSON.parse(fs.readFileSync(cfgPath(), 'utf8')));
  } catch {
    config = structuredClone(DEFAULT);
    saveConfigFile();
  }
  // Isi kalender pendidikan bawaan satu kali bila daftar di laptop masih kosong
  // (mis. tersimpan kosong saat versi sebelumnya terpasang tanpa data kaldik).
  if (!config.widget || !config.widget.opV2) {
    config.widget = config.widget || {};
    if (!config.widget.transparansi || Number(config.widget.transparansi) >= 90) config.widget.transparansi = 60;
    config.widget.opV2 = true;
    saveConfigFile();
  }
  if (!config.kaldikTerisi) {
    if (!Array.isArray(config.kaldik) || !config.kaldik.length) config.kaldik = structuredClone(DEFAULT.kaldik || []);
    config.kaldikTerisi = true;
    saveConfigFile();
  }
}
function saveConfigFile() {
  fs.mkdirSync(path.dirname(cfgPath()), { recursive: true });
  fs.writeFileSync(cfgPath(), JSON.stringify(config, null, 2), 'utf8');
}
function applyConfig() {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    app.setLoginItemSettings({ openAtLogin: !!config.umum.autostart });
  }
  placeIsland();
  if (bk) {
    const b = config.bukukelas || {};
    const ganti = bk.url !== b.url || bk.anonKey !== b.anonKey;
    bk.setKonfigurasi(b.url, b.anonKey);
    if (ganti) bk.mulai();
  }
  // nyalakan/matikan proses bantu sesuai pengaturan hemat
  const u = config.umum || {};
  if (u.fiturMedia === false && mediaProc) mediaProc.kill(); else if (u.fiturMedia !== false && !mediaProc && island) startMedia();
  if (u.fiturKontrol === false && kontrolProc) kontrolProc.kill(); else if (u.fiturKontrol !== false && !kontrolProc && island) startKontrol();
  aturWidget();
  broadcast('cfg:updated', config);
}
function broadcast(ch, data) {
  BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed()) w.webContents.send(ch, data); });
}

// ---------- Jendela pulau ----------
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function kirimAnchor() { if (island) island.webContents.send('island:anchor', anchor); }
function placeIsland() {
  if (!island) return;
  const pos = config.tampilan.posisi;
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
    const wa = screen.getDisplayMatching({ x: pos.x, y: pos.y, width: WIN_W, height: WIN_H }).workArea;
    anchor = { h: pos.h || 'tengah', v: pos.v || 'atas' };
    island.setBounds({
      x: clamp(pos.x, wa.x, wa.x + wa.width - WIN_W),
      y: clamp(pos.y, wa.y, wa.y + wa.height - WIN_H),
      width: WIN_W, height: WIN_H
    });
  } else {
    const { x, y, width } = screen.getPrimaryDisplay().workArea;
    anchor = { h: 'tengah', v: 'atas' };
    island.setBounds({
      x: Math.round(x + (width - WIN_W) / 2),
      y: y + Number(config.tampilan.jarakAtas || 0),
      width: WIN_W,
      height: WIN_H
    });
  }
  kirimAnchor();
}
// Seret pil: renderer mengirim posisi jendela yang diinginkan selama menyeret,
// lalu saat dilepas mengirim kotak pil (relatif ke jendela) agar arah buka bisa ditentukan.
ipcMain.handle('island:pos', () => island ? island.getPosition() : [0, 0]);
const angka = v => Number.isFinite(Number(v));
ipcMain.on('island:geser', (e, x, y) => {
  // abaikan nilai tidak valid (mis. NaN dari peristiwa mouse yang tidak lengkap) agar tidak memicu error
  if (!island || !angka(x) || !angka(y)) return;
  try { island.setPosition(clamp(Math.round(x), -20000, 20000), clamp(Math.round(y), -20000, 20000)); } catch { /* abaikan */ }
});
ipcMain.on('island:lepas', (e, r) => {
  if (!island || !r || ![r.x, r.y, r.w, r.h].every(angka)) return;
  const [wx, wy] = island.getPosition();
  const px = wx + r.x, py = wy + r.y;                      // kotak pil di layar
  const cx = px + r.w / 2, cy = py + r.h / 2;
  const wa = screen.getDisplayNearestPoint({ x: Math.round(cx), y: Math.round(cy) }).workArea;
  const h = cx < wa.x + wa.width / 3 ? 'kiri' : (cx > wa.x + wa.width * 2 / 3 ? 'kanan' : 'tengah');
  const v = cy > wa.y + wa.height / 2 ? 'bawah' : 'atas';
  let nx = h === 'kiri' ? px : (h === 'kanan' ? px + r.w - WIN_W : cx - WIN_W / 2);
  let ny = v === 'atas' ? py : py + r.h - WIN_H;
  nx = clamp(Math.round(nx), wa.x, wa.x + wa.width - WIN_W);
  ny = clamp(Math.round(ny), wa.y, wa.y + wa.height - WIN_H);
  anchor = { h, v };
  island.setPosition(nx, ny);
  config.tampilan.posisi = { x: nx, y: ny, h, v };
  saveConfigFile();
  kirimAnchor();
});
function resetPosisi() {
  delete config.tampilan.posisi;
  saveConfigFile();
  placeIsland();
  broadcast('cfg:updated', config);
}
ipcMain.on('island:reset', resetPosisi);

function createIsland() {
  island = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false
    }
  });
  island.setAlwaysOnTop(true, 'screen-saver');
  island.setVisibleOnAllWorkspaces(true);
  island.loadFile('island.html');
  island.webContents.on('did-finish-load', kirimAnchor);
  island.once('ready-to-show', () => {
    placeIsland();
    island.setIgnoreMouseEvents(true, { forward: true });
    island.showInactive();
  });
  island.on('close', e => { if (!quitting) { e.preventDefault(); island.hide(); } });
}

function toggleIsland() {
  if (!island) return;
  if (island.isVisible()) { sembunyiManual = true; island.hide(); }
  else { sembunyiManual = false; placeIsland(); island.showInactive(); }
}
// Mode presentasi otomatis: sembunyikan pil saat ada aplikasi layar penuh / slide show.
function aturLayarPenuh(status) {
  if (!island) return;
  const penuh = [2, 3, 4].includes(Number(status));
  const aktif = (config.umum || {}).sembunyiPresentasi !== false;
  if (penuh && aktif && !sembunyiPresentasi && island.isVisible()) {
    sembunyiPresentasi = true; island.hide();
  } else if ((!penuh || !aktif) && sembunyiPresentasi) {
    sembunyiPresentasi = false;
    if (!sembunyiManual) island.showInactive();
  }
}

// ---------- Jendela pengaturan ----------
function openSettings() {
  if (settingsWin) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 720,
    minHeight: 560,
    title: 'Pengaturan Dynamic Island',
    icon: path.join(__dirname, 'assets', 'tray.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWin.loadFile('settings.html');
  settingsWin.on('closed', () => { settingsWin = null; });
}

// ---------- Jendela panel kelas ----------
function openKelas(arg = {}) {
  if (kelasWin) {
    kelasWin.show(); kelasWin.focus();
    kelasWin.webContents.send('kelas:buka', arg);
    return;
  }
  kelasWin = new BrowserWindow({
    width: 640,
    height: 760,
    minWidth: 480,
    minHeight: 520,
    title: 'Panel Kelas',
    icon: path.join(__dirname, 'assets', 'tray.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  kelasWin.loadFile('kelas.html', { query: { buka: JSON.stringify(arg) } });
  kelasWin.on('closed', () => { kelasWin = null; });
}

// ---------- Widget desktop ----------
// Lapisan desktop ala macOS: kartu selalu berada di BAWAH semua jendela aplikasi.
// Windows tidak punya opsi "selalu di bawah" di Electron, jadi dipanggil langsung SetWindowPos(HWND_BOTTOM)
// lewat koffi (FFI tanpa kompilasi). Bila koffi gagal dimuat, kartu tetap jalan seperti biasa.
let user32 = null;
// Status untuk Pengaturan → Widget Desktop, agar kegagalan tidak diam-diam
const lapisan = { platform: process.platform, koffi: 'belum dicoba', panggilanOk: 0, panggilanGagal: 0, galat: '' };
if (process.platform === 'win32') {
  try {
    const koffi = require('koffi');
    const lib = koffi.load('user32.dll');
    user32 = {
      SetWindowPos: lib.func('bool __stdcall SetWindowPos(intptr_t hWnd, intptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint32_t uFlags)'),
      GetLastError: koffi.load('kernel32.dll').func('uint32_t __stdcall GetLastError()')
    };
    lapisan.koffi = 'termuat (versi ' + koffi.version + ')';
  } catch (e) { lapisan.koffi = 'GAGAL dimuat'; lapisan.galat = String(e && e.message || e); console.error('koffi/user32 tidak termuat:', e); }
} else lapisan.koffi = 'tidak dipakai (bukan Windows)';
const HWND_BOTTOM = 1, SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_NOACTIVATE = 0x10, SWP_NOOWNERZORDER = 0x200, SWP_NOSENDCHANGING = 0x400;
function keBawah(win) {
  if (!user32 || !win || win.isDestroyed()) return false;
  try {
    const h = win.getNativeWindowHandle();
    const hwnd = h.length >= 8 ? h.readBigUInt64LE(0) : BigInt(h.readUInt32LE(0));
    const ok = user32.SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_NOSENDCHANGING);
    if (ok) lapisan.panggilanOk++;
    else { lapisan.panggilanGagal++; lapisan.galat = 'SetWindowPos gagal, kode ' + user32.GetLastError(); }
    return !!ok;
  } catch (e) { lapisan.panggilanGagal++; lapisan.galat = String(e && e.message || e); return false; }
}
// Jaga terus: bila ada yang menaikkan kartu (mis. Windows saat ukuran berubah), turunkan lagi dalam ±1 detik.
setInterval(() => { for (const w of Object.values(widgets)) if (w.isVisible()) keBawah(w); }, 1000);
ipcMain.handle('widget:lapisan', () => ({ ...lapisan, aktif: !!user32 }));
/** Tampilkan kartu tanpa merebut fokus, lalu langsung turunkan ke lapisan paling bawah. */
function tampilDiBawah(win) { if (!win || win.isDestroyed()) return; win.showInactive(); keBawah(win); }

// Setiap kartu adalah jendela transparan tersendiri di belakang jendela lain: bisa diseret ke mana saja
// lewat judulnya, dan diperbesar/diperkecil (70–160%) lewat pojok kanan bawah atau Ctrl+scroll.
// Posisi dan skala tiap kartu disimpan di config.widget.kartuPos[id] = { x, y, skala }.
const KARTU_WIDGET = ['jam', 'sholatCuaca', 'jadwal', 'kalender', 'kelasHariIni', 'tugas', 'catatan', 'ulangTahun', 'motivasi'];
let perluRapikan = false;
const wcfg = () => (config.widget = config.widget || {});
const kartuPos = id => ((wcfg().kartuPos || {})[id]) || {};
function simpanKartuPos(id, ubah) {
  const w = wcfg();
  w.kartuPos = { ...(w.kartuPos || {}), [id]: { ...kartuPos(id), ...ubah } };
  saveConfigFile();
}
const kartuAktif = id => wcfg().aktif !== false && ((wcfg().kartu || {})[id] !== false);
function createKartu(id) {
  if (widgets[id] || quitting) return;
  const p = kartuPos(id);
  const ada = Number.isFinite(p.x) && Number.isFinite(p.y);
  // belum punya posisi: bila semua kartu baru (pemakaian pertama) susun semuanya; bila ada kartu lama, cari tempat kosong
  const adaKartuLama = KARTU_WIDGET.some(k => k !== id && Number.isFinite(kartuPos(k).x));
  const wa = screen.getPrimaryDisplay().workArea;
  const win = new BrowserWindow({
    x: ada ? p.x : wa.x + wa.width - 330, y: ada ? p.y : wa.y + 12, width: 316, height: 200,
    frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false, alwaysOnTop: false, show: false,
    title: 'Widget Desktop',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.kartuId = id;
  win.ukuranSiap = false;
  win.perluTempat = !ada && adaKartuLama;
  if (!ada && !adaKartuLama) perluRapikan = true;
  widgets[id] = win;
  win.loadFile('widget.html', { query: { kartu: id } });
  win.once('ready-to-show', () => tampilDiBawah(win));
  // diklik / diseret / berubah ukuran -> Windows menaikkannya ke atas; turunkan lagi ke lapisan desktop
  win.on('focus', () => setTimeout(() => keBawah(win), 0));
  win.on('blur', () => keBawah(win));
  win.on('show', () => keBawah(win));
  win.on('moved', () => {
    if (win.isDestroyed()) return;
    const [x, y] = win.getPosition();
    simpanKartuPos(id, { x, y });
    keBawah(win);
  });
  win.on('close', e => { if (!quitting) e.preventDefault(); });
  win.on('closed', () => { if (widgets[id] === win) delete widgets[id]; });
}
function tutupKartu(id) { const w = widgets[id]; if (w) { delete widgets[id]; w.destroy(); } }
function aturWidget() {
  for (const id of KARTU_WIDGET) { if (kartuAktif(id)) createKartu(id); else tutupKartu(id); }
}
/** Pastikan kartu tetap terlihat di salah satu layar (mis. setelah monitor kedua dicabut). */
function jagaDiLayar(win) {
  const b = win.getBounds();
  const wa = screen.getDisplayMatching(b).workArea;
  const x = clamp(b.x, wa.x - b.width + 80, wa.x + wa.width - 80), y = clamp(b.y, wa.y, wa.y + wa.height - 60);
  if (x !== b.x || y !== b.y) win.setPosition(x, y);
}
// Perkiraan tinggi penuh tiap kartu (px, skala 100%) agar ruang yang disediakan cukup walau datanya belum termuat.
const TINGGI_PERKIRAAN = { jam: 170, sholatCuaca: 420, jadwal: 300, kalender: 440, kelasHariIni: 300, tugas: 280, catatan: 190, ulangTahun: 170, motivasi: 150 };
function tempatkanBaru() {
  for (const id of KARTU_WIDGET) {
    const win = widgets[id];
    if (!win || win.isDestroyed() || !win.perluTempat) continue;
    const t = id === 'jam' ? posisiTengah(win) : tempatKosong(win);
    win.perluTempat = false;
    win.setPosition(t.x, t.y); simpanKartuPos(id, t); tampilDiBawah(win);
  }
}
/** Kartu jam: di tengah layar, sedikit di atas garis tengah. */
function posisiTengah(win) {
  const wa = screen.getPrimaryDisplay().workArea;
  const [w, h] = win.getSize();
  return { x: Math.round(wa.x + (wa.width - w) / 2), y: Math.round(wa.y + (wa.height - h) / 2 - wa.height * 0.08) };
}
/** Cari posisi kosong untuk kartu baru: kolom dari kanan ke kiri, dari atas ke bawah, tidak menimpa kartu lain. */
function tempatKosong(win) {
  const wa = screen.getPrimaryDisplay().workArea;
  const skala = Number(kartuPos(win.kartuId).skala) || 1;
  const [w, hNyata] = win.getSize();
  const tinggiPenuh = b => Math.max(b.height, Math.round((TINGGI_PERKIRAAN[b.id] || 0) * (Number(kartuPos(b.id).skala) || 1)));
  const h = Math.max(hNyata, Math.round((TINGGI_PERKIRAAN[win.kartuId] || 0) * skala));
  const lain = Object.values(widgets).filter(x => x !== win && !x.isDestroyed() && !x.perluTempat)
    .map(x => { const b = { ...x.getBounds(), id: x.kartuId }; return { ...b, height: tinggiPenuh(b) }; });
  const tabrak = (x, y) => lain.some(b => x + 8 < b.x + b.width - 8 && x + w - 8 > b.x + 8 && y + 8 < b.y + b.height - 8 && y + h - 8 > b.y + 8);
  for (let x = wa.x + wa.width - 12 - w; x >= wa.x; x -= 20) {
    for (let y = wa.y + 12; y + h <= wa.y + wa.height; y += 20) if (!tabrak(x, y)) return { x, y };
  }
  return { x: wa.x + Math.round((wa.width - w) / 2), y: wa.y + 40 };   // layar penuh: taruh di tengah
}
/** Susun semua kartu dari pojok kanan atas ke bawah; bila tidak muat, lanjut ke kolom di sebelah kirinya. */
function rapikanKartu() {
  const wa = screen.getPrimaryDisplay().workArea;
  let kanan = wa.x + wa.width - 12, y = wa.y + 12, lebarKolom = 0;
  for (const id of KARTU_WIDGET) {
    const win = widgets[id]; if (!win || win.isDestroyed()) continue;
    if (id === 'jam') { const t = posisiTengah(win); win.setPosition(t.x, t.y); simpanKartuPos(id, t); tampilDiBawah(win); continue; }
    const [w, h] = win.getSize();
    if (y > wa.y + 12 && y + h > wa.y + wa.height - 8) { kanan -= lebarKolom + 4; y = wa.y + 12; lebarKolom = 0; }
    win.setPosition(Math.round(kanan - w), Math.round(y));
    simpanKartuPos(id, { x: Math.round(kanan - w), y: Math.round(y) });
    y += h - 6; lebarKolom = Math.max(lebarKolom, w);   // jendela punya tepi transparan 8 px
    tampilDiBawah(win);
  }
  perluRapikan = false;
}
function tampilkanWidget() {
  wcfg().aktif = true; saveConfigFile();
  aturWidget();
  Object.values(widgets).forEach(w => { jagaDiLayar(w); tampilDiBawah(w); });
  broadcast('cfg:updated', config);
}
function sembunyikanWidget() {
  wcfg().aktif = false; saveConfigFile(); aturWidget(); broadcast('cfg:updated', config);
}
const kartuDari = e => { const w = BrowserWindow.fromWebContents(e.sender); return w && w.kartuId && widgets[w.kartuId] === w ? w : null; };
// Renderer melaporkan ukuran isi (sudah termasuk skala). Pojok kiri atas tetap di tempat.
ipcMain.on('widget:ukuran', (e, w, h) => {
  const win = kartuDari(e);
  if (!win || !angka(w) || !angka(h)) return;
  const lebar = clamp(Math.ceil(Number(w)), 120, 1400), tinggi = clamp(Math.ceil(Number(h)), 60, 2000);
  const [lw, lh] = win.getSize();
  if (lw !== lebar || lh !== tinggi) {
    // jendela berukuran tetap mengabaikan setSize di sebagian sistem, jadi buka kuncinya sebentar
    win.setResizable(true); win.setSize(lebar, tinggi); win.setResizable(false); keBawah(win);
  }
  if (win.perluTempat) {
    // tunggu sebentar agar semua kartu baru sudah melapor, lalu tempatkan satu per satu
    clearTimeout(tempatkanBaru.t); tempatkanBaru.t = setTimeout(tempatkanBaru, 2500);
  }
  if (!win.ukuranSiap) {
    win.ukuranSiap = true;
    if (perluRapikan && Object.values(widgets).every(x => x.ukuranSiap)) {
      // tunggu isi kartu (data BukuKelas, cuaca) selesai dimuat agar tinggi kartu sudah final
      clearTimeout(rapikanKartu.t); rapikanKartu.t = setTimeout(rapikanKartu, 2500);
    } else jagaDiLayar(win);
  }
});
ipcMain.on('widget:skala', (e, skala) => {
  const win = kartuDari(e);
  if (win && angka(skala)) simpanKartuPos(win.kartuId, { skala: clamp(Math.round(Number(skala) * 100) / 100, 0.7, 1.6) });
});
ipcMain.on('widget:reset', () => rapikanKartu());
// Daftar tugas & catatan cepat disimpan di config agar ikut tersimpan dan terbaca semua jendela
ipcMain.on('tugas:simpan', (e, list) => {
  if (!Array.isArray(list)) return;
  config.tugas = list.filter(t => t && typeof t.teks === 'string' && t.teks.trim()).slice(0, 200)
    .map(t => ({ id: String(t.id || Date.now()), teks: t.teks.trim().slice(0, 300), tenggat: /^\d{4}-\d{2}-\d{2}$/.test(t.tenggat || '') ? t.tenggat : '', selesai: !!t.selesai, waktu: Number(t.waktu) || Date.now() }));
  saveConfigFile(); broadcast('cfg:updated', config);
});
// Motivasi yang sedang dipilih manual (berlaku sampai hari berganti)
ipcMain.on('motivasi:pilih', (e, idx) => {
  if (!angka(idx)) return;
  const d = new Date();
  config.motivasiPilih = { tgl: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, idx: Math.max(0, Math.floor(Number(idx))) };
  saveConfigFile();
});
ipcMain.on('catatan:simpan', (e, teks) => {
  config.catatan = String(teks || '').slice(0, 5000);
  saveConfigFile();
  BrowserWindow.getAllWindows().forEach(w => { if (w.webContents !== e.sender && !w.isDestroyed()) w.webContents.send('cfg:updated', config); });
});
ipcMain.on('widget:skala100', () => {
  for (const id of KARTU_WIDGET) simpanKartuPos(id, { skala: 1 });
  broadcast('cfg:updated', config);
});

// ---------- BukuKelas ----------
async function initBukuKelas() {
  const b = config.bukukelas || {};
  let ada = false;
  try { ada = await safeStorage.isAsyncEncryptionAvailable(); } catch { ada = false; }
  // API asinkron (yang dianjurkan Electron); API sinkron sudah usang.
  const crypt = ada
    ? { encrypt: s => safeStorage.encryptStringAsync(s), decrypt: async buf => (await safeStorage.decryptStringAsync(buf)).result }
    : null;
  bk = new BukuKelas({ url: b.url, anonKey: b.anonKey, dir: app.getPath('userData'), crypt, emit: broadcast });
  bk.mulai();
  // kirim ulang antrean & segarkan data secara berkala
  let tglTerakhir = new Date().toDateString();
  setInterval(() => bk.kirimAntrean(), 30 * 1000);
  setInterval(() => {
    const kini = new Date().toDateString();
    if (bk.user && (kini !== tglTerakhir || Date.now() - ((bk.data && bk.data.diperbarui) || 0) > 10 * 60 * 1000)) {
      tglTerakhir = kini;
      bk.muat();
    }
  }, 60 * 1000);
}
const aman = fn => async (e, ...a) => {
  try { return { ok: true, hasil: await fn(...a) }; }
  catch (err) { return { ok: false, galat: String(err && err.message || err) }; }
};
ipcMain.handle('bk:status', () => bk ? bk.status() : { siapKonfig: false, masuk: false });
ipcMain.handle('bk:masuk', aman((email, pw) => bk.masuk(email, pw)));
ipcMain.handle('bk:keluar', aman(() => bk.keluar()));
ipcMain.handle('bk:muat', aman(tgl => bk.muat(tgl)));
ipcMain.handle('bk:absen', aman(tgl => bk.absen(tgl)));
ipcMain.handle('bk:setAbsen', aman((sid, tgl, v) => bk.setAbsen(sid, tgl, v)));
ipcMain.handle('bk:nilai', aman(mapelId => bk.nilaiMapel(mapelId)));
ipcMain.handle('bk:setNilai', aman((sid, mapelId, kunci, v) => bk.setNilai(sid, mapelId, kunci, v)));
ipcMain.handle('bk:jurnal', aman(tgl => bk.jurnal(tgl)));
ipcMain.handle('bk:simpanJurnal', aman(j => bk.simpanJurnal(j)));
ipcMain.handle('bk:hapusJurnal', aman(k => bk.hapusJurnal(k)));
ipcMain.on('kelas:open', (e, arg) => openKelas(arg || {}));

// ---------- Media (Windows) ----------
function mediaScriptPath() {
  return path.join(__dirname, 'media.ps1').replace('app.asar', 'app.asar.unpacked');
}
function startMedia() {
  if (process.platform !== 'win32' || quitting || (config.umum || {}).fiturMedia === false) return;
  mediaProc = spawn('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', mediaScriptPath()],
    { windowsHide: true });
  let buf = '';
  mediaProc.stdout.setEncoding('utf8');
  mediaProc.stdout.on('data', chunk => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        const o = JSON.parse(line);
        if (o.media) { island && island.webContents.send('media:update', o.media); aturLayarPenuh(o.layar); }
        else if (island) island.webContents.send('media:update', o);
      } catch { /* abaikan baris rusak */ }
    }
  });
  mediaProc.on('exit', () => { mediaProc = null; if (!quitting && (config.umum || {}).fiturMedia !== false) setTimeout(startMedia, 5000); });
}

// Tombol media global: Play/Pause=179, Next=176, Previous=177
const MEDIA_KEYS = { playpause: 179, next: 176, prev: 177 };
function sendMediaKey(cmd) {
  const code = MEDIA_KEYS[cmd];
  if (!code || process.platform !== 'win32') return;
  spawn('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', `(New-Object -ComObject WScript.Shell).SendKeys([char]${code})`],
    { windowsHide: true });
}

// ---------- Volume & kecerahan (Windows) ----------
function startKontrol() {
  if (process.platform !== 'win32' || quitting || (config.umum || {}).fiturKontrol === false) return;
  kontrolProc = spawn('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
      path.join(__dirname, 'kontrol.ps1').replace('app.asar', 'app.asar.unpacked')],
    { windowsHide: true });
  let buf = '';
  kontrolProc.stdout.setEncoding('utf8');
  kontrolProc.stdout.on('data', chunk => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      try { broadcast('kontrol:status', JSON.parse(line)); } catch { /* abaikan */ }
    }
  });
  kontrolProc.on('exit', () => { kontrolProc = null; if (!quitting && (config.umum || {}).fiturKontrol !== false) setTimeout(startKontrol, 5000); });
}
ipcMain.on('kontrol:cmd', (e, cmd) => {
  if (!/^(get|vol \d{1,3}|mute [01]|bri \d{1,3})$/.test(String(cmd))) return;
  if (kontrolProc && kontrolProc.stdin.writable) kontrolProc.stdin.write(cmd + '\n');
  else if (process.platform !== 'win32') broadcast('kontrol:status', { vol: null, mute: false, bri: null, galat: 'Hanya tersedia di Windows' });
});

// ---------- Cuaca (Open-Meteo, tanpa kunci API) ----------
let cuaca = null;
async function ambilCuaca() {
  const c = config.cuaca || {};
  if (c.aktif === false || !internet.online) return;
  const lat = Number(c.lat), lon = Number(c.lon);
  if (!isFinite(lat) || !isFinite(lon)) return;
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code' +
    '&hourly=temperature_2m,precipitation_probability,weather_code&forecast_hours=12&timezone=Asia%2FJakarta';
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
    const r = await net.fetch(url, { signal: ctl.signal }); clearTimeout(t);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    cuaca = {
      waktu: Date.now(),
      suhu: j.current.temperature_2m, terasa: j.current.apparent_temperature, lembap: j.current.relative_humidity_2m,
      siang: !!j.current.is_day, kode: j.current.weather_code,
      jam: (j.hourly.time || []).map((t, i) => ({ t, suhu: j.hourly.temperature_2m[i], hujan: j.hourly.precipitation_probability[i], kode: j.hourly.weather_code[i] }))
    };
    broadcast('cuaca', cuaca);
  } catch (e) { /* coba lagi nanti; data lama tetap dipakai */ }
}
ipcMain.handle('cuaca', () => cuaca);
ipcMain.on('cuaca:segarkan', () => ambilCuaca());

// ---------- Karakter unggahan ----------
const dirKarakter = () => path.join(app.getPath('userData'), 'karakter');
ipcMain.handle('karakter:simpan', (e, dataUrl, nama) => {
  const m = String(dataUrl).match(/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,(.+)$/);
  if (!m) throw new Error('Format gambar harus PNG, JPG, GIF, WEBP, atau SVG.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3 * 1024 * 1024) throw new Error('Ukuran gambar maksimal 3 MB.');
  const ext = m[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const id = 'u' + Date.now().toString(36);
  fs.mkdirSync(dirKarakter(), { recursive: true });
  fs.writeFileSync(path.join(dirKarakter(), id + '.' + ext), buf);
  const item = { id: 'u:' + id + '.' + ext, nama: String(nama || 'Karakter saya').slice(0, 40) };
  config.tampilan.karakterKustom = [...(config.tampilan.karakterKustom || []), item];
  config.tampilan.karakter = item.id;
  saveConfigFile(); applyConfig();
  return item;
});
ipcMain.handle('karakter:data', (e, id) => {
  const f = String(id || '').replace(/^u:/, '');
  if (!/^u[a-z0-9]+\.(png|jpg|gif|webp|svg)$/.test(f)) return null;
  try {
    const ext = f.split('.').pop();
    const mime = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }[ext];
    return `data:${mime};base64,` + fs.readFileSync(path.join(dirKarakter(), f)).toString('base64');
  } catch { return null; }
});
ipcMain.handle('karakter:hapus', (e, id) => {
  const f = String(id || '').replace(/^u:/, '');
  if (/^u[a-z0-9]+\.(png|jpg|gif|webp|svg)$/.test(f)) { try { fs.unlinkSync(path.join(dirKarakter(), f)); } catch { /* sudah tidak ada */ } }
  config.tampilan.karakterKustom = (config.tampilan.karakterKustom || []).filter(k => k.id !== id);
  if (config.tampilan.karakter === id) config.tampilan.karakter = 'hantu';
  saveConfigFile(); applyConfig();
  return config;
});

// ---------- Indikator internet ----------
// Hemat & tidak mudah salah:
// - saat tersambung cukup dicek tiap 60 detik, satu alamat dulu (alamat berikutnya hanya bila yang pertama gagal);
// - dianggap terputus hanya bila 3 kali cek berturut-turut gagal (±2 menit), agar jaringan yang sekadar lambat tidak memicu peringatan;
// - saat terputus dicek tiap 15 detik supaya cepat tahu bila sudah tersambung lagi.
let gagalBeruntun = 0, tCekInternet = null;
async function cobaAlamat(u, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await net.fetch(u, { signal: ctl.signal, cache: 'no-store' }); return r.status < 500; }
  catch { return false; }
  finally { clearTimeout(t); }
}
async function cekInternet() {
  clearTimeout(tCekInternet);
  let ok = false;
  if (net.isOnline()) {
    const alamat = ['https://www.gstatic.com/generate_204', 'https://1.1.1.1/cdn-cgi/trace'];
    if ((config.bukukelas || {}).url) alamat.push(config.bukukelas.url.replace(/\/$/, '') + '/auth/v1/health');
    for (const u of alamat) { if (await cobaAlamat(u, 12000)) { ok = true; break; } }
  }
  gagalBeruntun = ok ? 0 : gagalBeruntun + 1;
  const online = ok || (internet.online && gagalBeruntun < 3);
  if (online !== internet.online) { internet = { online, sejak: Date.now() }; if (online) setTimeout(ambilCuaca, 2000); }
  broadcast('sistem:internet', internet);
  tCekInternet = setTimeout(cekInternet, !ok ? 15 * 1000 : 60 * 1000);
}
ipcMain.handle('sistem:internet', () => internet);

// ---------- Membuka pintasan ----------
function expandEnv(s) {
  return s.replace(/%([^%]+)%/g, (m, n) => process.env[n] ?? m);
}
async function openTarget(target) {
  const t = expandEnv(String(target || '').trim());
  if (!t) return;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^(mailto|ms-settings):/i.test(t)) {
    await shell.openExternal(t);
  } else if (fs.existsSync(t)) {
    await shell.openPath(t);
  } else if (process.platform === 'win32') {
    // nama program terdaftar, misalnya winword, excel, notepad.exe, calc.exe
    exec(`start "" "${t.replace(/"/g, '')}"`, { windowsHide: true });
  }
}

// ---------- Pembaruan otomatis (GitHub Releases) ----------
// Hanya aktif pada versi terpasang (.exe). File unduhan dicek dengan sidik sha512 sebelum dipasang.
let pembaruan = { status: 'idle', versi: app.getVersion(), baru: null, persen: 0, galat: '' };
function kabarPembaruan(ubah) { pembaruan = { ...pembaruan, ...ubah }; broadcast('update:status', pembaruan); }
function siapkanPembaruan() {
  if (!autoUpdater || !app.isPackaged) { kabarPembaruan({ status: 'dev' }); return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => kabarPembaruan({ status: 'memeriksa', galat: '' }));
  autoUpdater.on('update-not-available', () => kabarPembaruan({ status: 'terbaru' }));
  autoUpdater.on('update-available', i => kabarPembaruan({ status: 'mengunduh', baru: i.version, persen: 0 }));
  autoUpdater.on('download-progress', p => kabarPembaruan({ persen: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', i => {
    kabarPembaruan({ status: 'siap', baru: i.version, persen: 100 });
    if (island) island.webContents.send('update:siap', i.version);
  });
  autoUpdater.on('error', e => kabarPembaruan({ status: 'galat', galat: String(e && e.message || e).split('\n')[0] }));
  const periksa = () => { if ((config.umum || {}).updateOtomatis !== false && internet.online) autoUpdater.checkForUpdates().catch(() => {}); };
  setTimeout(periksa, 20 * 1000);
  setInterval(periksa, 6 * 3600 * 1000);
}
ipcMain.handle('update:status', () => pembaruan);
ipcMain.on('update:periksa', () => {
  if (!autoUpdater || !app.isPackaged) { kabarPembaruan({ status: 'dev' }); return; }
  autoUpdater.checkForUpdates().catch(e => kabarPembaruan({ status: 'galat', galat: String(e.message || e) }));
});
ipcMain.on('update:pasang', () => { if (autoUpdater && pembaruan.status === 'siap') { quitting = true; autoUpdater.quitAndInstall(true, true); } });

// ---------- Logo pintasan ----------
// Program & folder: ikon asli dari Windows (app.getFileIcon). Situs web: logo situsnya (favicon).
let ikonCache = null;
const fileIkon = () => path.join(app.getPath('userData'), 'ikon-pintasan.json');
function cacheIkon() {
  if (!ikonCache) { try { ikonCache = JSON.parse(fs.readFileSync(fileIkon(), 'utf8')); } catch { ikonCache = {}; } }
  return ikonCache;
}
function simpanCacheIkon() { try { fs.writeFileSync(fileIkon(), JSON.stringify(ikonCache)); } catch { /* abaikan */ } }
function jalankan(cmd) {
  return new Promise(res => exec(cmd, { windowsHide: true, timeout: 5000 }, (err, out) => res(err ? '' : String(out))));
}
async function cariProgram(nama) {
  if (process.platform !== 'win32') return null;
  const exe = /\.[a-z0-9]+$/i.test(nama) ? nama : nama + '.exe';
  for (const akar of ['HKCU', 'HKLM']) {
    const out = await jalankan(`reg query "${akar}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}" /ve`);
    const m = out.match(/REG_(?:EXPAND_)?SZ\s+(.+)/);
    if (m) { const p = expandEnv(m[1].trim().replace(/^"|"$/g, '')); if (fs.existsSync(p)) return p; }
  }
  const w = (await jalankan(`where "${exe}"`)).split(/\r?\n/).map(x => x.trim()).find(x => x && fs.existsSync(x));
  return w || null;
}
async function ambilFavicon(url) {
  let host;
  try { host = new URL(url).origin; } catch { return null; }
  const calon = [`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(host)}`, `${host}/favicon.ico`, `${host}/icon-192.png`];
  for (const u of calon) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
      const r = await net.fetch(u, { signal: ctl.signal }); clearTimeout(t);
      const tipe = (r.headers.get('content-type') || '').split(';')[0];
      if (!r.ok || !/^image\//.test(tipe)) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 100 || buf.length > 500 * 1024) continue;
      return `data:${tipe};base64,${buf.toString('base64')}`;
    } catch { /* coba alamat berikutnya */ }
  }
  return null;
}
async function ikonPintasan(target, segar = false) {
  const t = expandEnv(String(target || '').trim());
  if (!t) return null;
  const c = cacheIkon();
  if (!segar && c[t] && Date.now() - c[t].waktu < 30 * 864e5) return c[t].data;
  let data = null;
  try {
    if (/^https?:\/\//i.test(t)) data = await ambilFavicon(t);
    else {
      const p = fs.existsSync(t) ? t : await cariProgram(t);
      if (p) { const img = await app.getFileIcon(p, { size: 'large' }); if (!img.isEmpty()) data = img.toDataURL(); }
    }
  } catch { data = null; }
  if (data) { c[t] = { data, waktu: Date.now() }; simpanCacheIkon(); }
  return data;
}
ipcMain.handle('ikon:pintasan', (e, target, segar) => ikonPintasan(target, !!segar));

// ---------- IPC ----------
ipcMain.handle('cfg:bawaan', () => DEFAULT);
ipcMain.handle('cfg:get', () => config);
ipcMain.handle('cfg:default', () => structuredClone(DEFAULT));
ipcMain.handle('cfg:save', (e, next) => {
  const posisi = config.tampilan.posisi; // posisi pil hanya diubah lewat seret / tombol kembalikan
  const posKartu = (config.widget || {}).kartuPos;
  const tugasLama = config.tugas, catatanLama = config.catatan, motivasiPilih = config.motivasiPilih;   // hanya diubah lewat kartunya sendiri
  if (next && next.tampilan) next.tampilan.karakterKustom = config.tampilan.karakterKustom || [];
  const lokasiLama = JSON.stringify(config.cuaca || {});
  config = merge(structuredClone(DEFAULT), next);
  if (posisi) config.tampilan.posisi = posisi; else delete config.tampilan.posisi;
  config.widget = { ...(config.widget || {}) };
  delete config.widget.posisi;                       // posisi lama (versi 1.6–1.8) tidak dipakai lagi
  if (posKartu) config.widget.kartuPos = posKartu; else delete config.widget.kartuPos;
  config.tugas = tugasLama || []; config.catatan = catatanLama || '';
  if (motivasiPilih) config.motivasiPilih = motivasiPilih;
  if (JSON.stringify(config.cuaca || {}) !== lokasiLama) setTimeout(ambilCuaca, 500);
  saveConfigFile();
  applyConfig();
  return config;
});
ipcMain.on('mouse:ignore', (e, ignore) => {
  if (!island) return;
  if (ignore) island.setIgnoreMouseEvents(true, { forward: true });
  else island.setIgnoreMouseEvents(false);
});
ipcMain.on('media:cmd', (e, cmd) => sendMediaKey(cmd));
ipcMain.on('open:target', (e, target) => { openTarget(target).catch(() => {}); });
ipcMain.on('notify', (e, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body, silent: true }).show();
});
ipcMain.on('settings:open', openSettings);
ipcMain.on('cfg:folder', () => shell.openPath(path.dirname(cfgPath())));

// ---------- Siklus aplikasi ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', openSettings);
  app.setAppUserModelId('id.dwi.dynamicisland');

  app.whenReady().then(async () => {
    loadConfig();
    createIsland();
    await initBukuKelas();
    startMedia();
    startKontrol();
    cekInternet();   // menjadwalkan dirinya sendiri (60 dtk saat tersambung, 15 dtk saat bermasalah)
    setTimeout(ambilCuaca, 3000);
    siapkanPembaruan();
    setInterval(ambilCuaca, 30 * 60 * 1000);

    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png')));
    tray.setToolTip('Dynamic Island');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Tampilkan / Sembunyikan  (Ctrl+Alt+D)', click: toggleIsland },
      { label: 'Kembalikan pil ke tengah atas', click: resetPosisi },
      { label: 'Widget desktop: tampilkan  (Ctrl+Alt+W)', click: tampilkanWidget },
      { label: 'Widget desktop: rapikan kartu', click: () => { tampilkanWidget(); rapikanKartu(); } },
      { label: 'Widget desktop: sembunyikan', click: sembunyikanWidget },
      { label: 'Panel Kelas…  (Ctrl+Alt+K)', click: () => openKelas() },
      { label: 'Pengaturan…  (Ctrl+Alt+S)', click: openSettings },
      { type: 'separator' },
      { label: 'Keluar', click: () => { quitting = true; app.quit(); } }
    ]));
    tray.on('click', toggleIsland);

    globalShortcut.register('Control+Alt+D', toggleIsland);
    globalShortcut.register('Control+Alt+S', openSettings);
    globalShortcut.register('Control+Alt+K', () => openKelas());
    globalShortcut.register('Control+Alt+W', () => (Object.values(widgets).some(w => w.isVisible()) ? sembunyikanWidget() : tampilkanWidget()));

    screen.on('display-metrics-changed', () => { placeIsland(); Object.values(widgets).forEach(jagaDiLayar); });
    screen.on('display-removed', () => Object.values(widgets).forEach(jagaDiLayar));
    screen.on('display-added', placeIsland);
    screen.on('display-removed', placeIsland);

    applyConfig();
  });

  app.on('before-quit', () => { quitting = true; if (mediaProc) mediaProc.kill(); if (kontrolProc) kontrolProc.kill(); });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', e => e.preventDefault());
}
