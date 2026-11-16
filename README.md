# Dynamic Island untuk Windows

## Pasang & pembaruan otomatis
- **Unduh installer:** https://github.com/dwiseptiyanasdn017/dynamic-island/releases/latest → `Dynamic-Island-Setup-x.y.z.exe`
- Setelah terpasang, aplikasi memeriksa versi baru setiap 6 jam, mengunduhnya di latar belakang, lalu menawarkan **"Pasang sekarang"** lewat pil. Pengaturan (jadwal, tema, login BukuKelas) tersimpan di `%APPDATA%\Dynamic Island` dan tidak berubah saat update.
- **Cara menerbitkan versi baru:** naikkan `version` di `package.json` lalu push ke `main`. GitHub Actions (`.github/workflows/rilis.yml`) membuat installer Windows dan menerbitkannya ke Releases.

Pil hitam di atas tengah layar, mirip Dynamic Island iPhone. Arahkan kursor ke pil untuk membesarkannya.

## Fitur
- **Beranda**: jam, tanggal, baterai, pelajaran yang sedang berlangsung beserta sisa waktunya, dan pelajaran berikutnya
- **Jadwal**: jadwal mengajar hari ini (Senin–Sabtu). Jam selesai dihitung otomatis dari jumlah JP (1 JP = 35 menit, bisa diubah)
- **Musik**: judul dan artis lagu/video yang sedang diputar (Spotify, YouTube di browser, Media Player, dll.), plus tombol ⏮ ⏯ ⏭
- **Timer**: tombol cepat 5/10/15/35 menit atau isi menit sendiri. Sisa waktunya tampil di pil
- **Pintasan**: membuka web (BukuKelas, PindaiDok), folder, atau program (Word, Excel) dengan sekali klik
- **Pengingat**: pil membesar, berdenyut, dan berbunyi beberapa menit sebelum pelajaran mulai, saat mulai, dan saat selesai. Ada juga pengingat khusus (rapat, piket, setor nilai)
- **Pengaturan**: warna dan tema, lebar, posisi, cara membuka (hover atau klik), jadwal, pengingat, pintasan, dan autostart

## Beranda & logo pintasan (versi 1.4)
- **Tata letak Beranda** bisa dipilih seperti tema (Pengaturan → Beranda): **Kotak Widget**, **Jam + Daftar**, **Minimalis**, atau **Klasik**. Kotak yang tampil (jam, pelajaran, sholat, cuaca, baterai, kehadiran kelas dari BukuKelas) bisa dicentang dan diurutkan sendiri dengan ▲ ▼.
- **Pintasan memakai logo asli**: ikon program dan folder diambil dari Windows (misalnya logo Word dan Excel), dan situs web memakai logonya sendiri. Logo disimpan di laptop agar tetap tampil saat offline.

## Isi pil kecil (versi 1.3.1)
Pengaturan → Tampilan → **Isi pil kecil**: pilih apa yang tampil saat pil kecil (karakter, jam, detik, sisa menit, suhu, baterai) dan info apa yang boleh tampil di tengah (timer, pelajaran sekarang, sholat, musik, pelajaran berikutnya, tanggal). Dengan **lebar otomatis**, pil melebar sesuai isinya sehingga tulisan tidak terpotong.

## Fitur versi 1.3
- **14 tema warna** (Hitam Klasik, Malam Biru, Senja, Aurora, Laut Dalam, Hutan, Kayu, Songket Melayu, Neon, Pelangi Ceria, Sakura, Langit Pagi, Permen Pastel, Terang) dengan pratinjau di Pengaturan → Tampilan. Bisa juga warna sendiri dengan gradien dan pinggiran bercahaya. Pilihan **"ikut warna mapel"** membuat warna aksen berganti sesuai mapel yang sedang berlangsung (warnanya sama dengan di BukuKelas).
- **Karakter**: 16 hewan lucu (Burung Hantu, Kucing, Kelinci, Panda, Singa, Harimau, Gajah, Jerapah, Burung Biru, Sapi, Domba, Rusa, Rubah, Penguin, Kura-kura, Ayam) atau **unggah gambar sendiri** (PNG/JPG/GIF bergerak/WEBP, maks. 3 MB). Karakter berayun pelan di pil dan melompat saat ada pengingat.
- **Pengingat minum air** tiap 60 menit pada jam sekolah (bisa diatur).
- **Cuaca** di Beranda: suhu, kondisi, dan peringatan hujan dalam 6 jam ke depan. Pengingat PJOK, upacara, dan Adiwiyata ikut memberi tahu bila kemungkinan hujan ≥ 50%. Lokasi diatur di Pengaturan → Cuaca.
- **Peringatan baterai** di 20% dan 10% saat charger tidak terpasang; pil diberi garis merah berdenyut sampai charger dicolokkan.

## Fitur versi 1.2
- **Pil bisa digeser ke mana saja.** Seret pil kecilnya, atau garis kecil di bagian atas saat pil terbuka. Posisi diingat. Kalau pil ditaruh di bawah layar, ia membuka ke atas; di kiri/kanan, ia membuka ke arah tengah. Kembalikan lewat Pengaturan → Tampilan, atau klik kanan ikon tray → *Kembalikan pil ke tengah atas*.
- **Kalender**: tab Kalender berisi tampilan satu bulan. Minggu dan libur nasional berwarna merah, libur sekolah dari BukuKelas diberi titik kuning. Klik tanggal untuk melihat keterangannya.
- **Jadwal sholat**: tampil di Beranda, dengan pengingat 10 menit sebelum dan tepat waktu. Dihitung tanpa internet dengan kriteria Kemenag; untuk Kab. Indragiri Hulu hasilnya sama dengan jadwal Bimas Islam Kemenag (selisih paling banyak 1 menit). Atur di Pengaturan → Jadwal Sholat.
- **Indikator internet**: pil menampilkan "⚠ offline" saat internet putus, dan memberi tahu saat terputus dan tersambung kembali.
- **Volume & kecerahan**: penggeser di tab Media, lengkap dengan tombol senyap. Kecerahan hanya bisa diatur untuk layar laptop (bukan monitor eksternal).
- **Mode presentasi otomatis**: pil bersembunyi saat PowerPoint slide show atau video layar penuh, lalu muncul lagi sesudahnya. Bisa dimatikan di Pengaturan → Umum.

## Tersambung ke BukuKelas (versi 1.1)
Masuk sekali dengan akun bukukelas.vercel.app (Pengaturan → BukuKelas → Buka Panel Kelas). Sesudah itu:
- **Tab Kelas di pulau**: jumlah hadir, siapa yang tidak hadir, dan tombol **Acak siswa** (siswa yang tidak hadir tidak ikut, dan nama yang sudah keluar tidak muncul lagi sampai semua kebagian).
- **Panel Kelas** (`Ctrl+Alt+K`):
  - **Presensi**: klik S / I / A, langsung masuk ke menu Presensi BukuKelas.
  - **Nilai**: pilih mapel, jenis (TP, materi, SAS, pengayaan, remedial), materi, dan TP, lalu ketik nilai dan tekan Enter untuk pindah ke siswa berikutnya. Nilai di bawah KKTP berwarna merah.
  - **Jurnal**: mapel, materi, TP, jam ke-, kegiatan, catatan. Bisa diubah dan dihapus.
  - **Acak & Kelompok**: tampilan besar untuk proyektor, kelompok dibagi dari siswa yang hadir.
- **Tawaran jurnal otomatis**: saat pelajaran di jadwal selesai, pulau bertanya "Isi jurnal?". Mapel dan jam ke- sudah terisi.
- **Libur**: pada hari libur nasional dan libur sekolah (dari BukuKelas), pengingat pelajaran tidak muncul.
- Kalau internet putus, perubahan disimpan dulu di laptop lalu dikirim otomatis saat tersambung lagi.
- Kata sandi tidak disimpan. Yang disimpan hanya tanda masuk, terenkripsi oleh Windows.

Di Pengaturan → Jadwal Mengajar ada kolom **Mapel di BukuKelas**. Biasanya cukup "Otomatis" (misalnya PAI → Pendidikan Agama Islam dan Budi Pekerti). Ubah hanya kalau ada yang salah cocok.

Pintasan keyboard: `Ctrl+Alt+D` untuk menampilkan/menyembunyikan pil, `Ctrl+Alt+S` untuk membuka Pengaturan, `Ctrl+Alt+K` untuk membuka Panel Kelas.
Ikon aplikasi juga muncul di system tray (pojok kanan bawah).

## Cara menjalankan (sekali saja)
1. Instal **Node.js LTS** dari https://nodejs.org (centang semua opsi bawaan).
2. Ekstrak folder ini, misalnya ke `D:\dynamic-island`.
3. Buka folder itu di File Explorer, klik address bar, ketik `cmd`, lalu tekan Enter.
4. Jalankan:
   ```
   npm install
   npm start
   ```

## Membuat installer .exe (agar tidak perlu cmd lagi)
```
npm run build
```
Hasilnya ada di folder `dist\`:
- `Dynamic Island Setup 1.0.0.exe` adalah installer (membuat shortcut di desktop)
- `Dynamic Island 1.0.0.exe` adalah versi portable, langsung jalan tanpa instal

Setelah terinstal, buka Pengaturan → Umum → centang **Jalankan otomatis saat Windows menyala**.

## Catatan
- Pengaturan disimpan di `%APPDATA%\Dynamic Island\config.json`. Bisa diekspor/impor dari Pengaturan → Umum.
- Jadwal bawaan hanyalah **contoh**. Ganti di Pengaturan → Jadwal Mengajar. Tombol "+ Tambah lanjutan" otomatis mengisi jam mulai tepat setelah pelajaran sebelumnya selesai.
- Saat menonton video layar penuh, pil tetap di atas. Tekan `Ctrl+Alt+D` untuk menyembunyikannya sementara.
- Bila Windows SmartScreen memperingatkan saat membuka .exe, klik **More info → Run anyway** (aplikasi buatan sendiri belum bertanda tangan digital).
