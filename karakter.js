'use strict';
/* Karakter Dynamic Island: satu kucing belang abu-abu (gambar dibuat Bu Dwi lewat ChatGPT).
   Sprite per gerakan ada di assets/kucing; SPRITE_KUCING menyimpan ukuran tiap gambar dan titik jangkarnya
   (ax, ay = titik telapak kaki; untuk "angkat" = ujung kepala) pada skala tinggi duduk 305 px. */
(function (g) {
  const SPRITE = {"kedip_1":{"w":237,"h":305,"ax":108.6,"ay":302.4},"kedip_2":{"w":236,"h":305,"ax":107.6,"ay":302.4},"kedip_3":{"w":237,"h":305,"ax":108.6,"ay":302.4},"jalan_1":{"w":270,"h":289,"ax":134.4,"ay":285.4},"jalan_2":{"w":274,"h":288,"ax":138.4,"ay":284.4},"jalan_3":{"w":275,"h":287,"ax":139.4,"ay":283.4},"jalan_4":{"w":271,"h":292,"ax":135.4,"ay":288.4},"jalan_5":{"w":277,"h":293,"ax":141.4,"ay":289.4},"senang_1":{"w":235,"h":247,"ax":107.6,"ay":246.8},"senang_2":{"w":223,"h":252,"ax":104.6,"ay":294.8},"senang_3":{"w":225,"h":272,"ax":105.6,"ay":269.8},"angkat_1":{"w":237,"h":400,"ax":123.5,"ay":3.0},"angkat_2":{"w":236,"h":391,"ax":122.5,"ay":3.0},"tidur_1":{"w":291,"h":217,"ax":123.6,"ay":215.4}};
  const src = n => `assets/kucing/${n}.png`;
  g.SPRITE_KUCING = SPRITE;
  g.srcKucing = src;
  g.KARAKTER = { kucing: { nama: 'Kucing', src: src('kedip_1'), html: `<img src="${src('kedip_1')}" alt="Kucing" draggable="false">` } };
  g.KARAKTER_BAWAAN = 'kucing';
  // semua id lama (16 karakter & gambar unggahan) kini menjadi kucing; 'none' = karakter disembunyikan
  g.karakterId = id => id === 'none' ? 'none' : 'kucing';
})(typeof window !== 'undefined' ? window : globalThis);
