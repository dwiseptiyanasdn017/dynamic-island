'use strict';
/* Karakter bawaan Dynamic Island (gambar dari Bu Dwi, dipotong menjadi 16 PNG transparan di assets/karakter). */
(function (g) {
  const daftar = [
    ['hantu', 'Burung Hantu'], ['kucing', 'Kucing'], ['kelinci', 'Kelinci'], ['panda', 'Panda'],
    ['singa', 'Singa'], ['harimau', 'Harimau'], ['gajah', 'Gajah'], ['jerapah', 'Jerapah'],
    ['burung', 'Burung Biru'], ['sapi', 'Sapi'], ['domba', 'Domba'], ['rusa', 'Rusa'],
    ['rubah', 'Rubah'], ['penguin', 'Penguin'], ['kura', 'Kura-kura'], ['ayam', 'Ayam']
  ];
  const KARAKTER = {};
  for (const [id, nama] of daftar) {
    KARAKTER[id] = { nama, src: `assets/karakter/${id}.png`, html: `<img src="assets/karakter/${id}.png" alt="${nama}" draggable="false">` };
  }
  // id karakter versi lama -> karakter baru yang mirip
  const LAMA = { oren: 'kucing', huhu: 'hantu', kiki: 'kelinci', bambu: 'panda', dino: 'kura', tetes: 'burung', mentari: 'singa', robo: 'penguin' };
  g.KARAKTER = KARAKTER;
  g.KARAKTER_BAWAAN = 'hantu';
  g.karakterId = id => (id && (id === 'none' || id.startsWith('u:') || KARAKTER[id])) ? id : (LAMA[id] || 'hantu');
})(typeof window !== 'undefined' ? window : globalThis);
