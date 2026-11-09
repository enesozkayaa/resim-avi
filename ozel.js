// =============================================================
// Resim Avı - "Kendi kartlarım": oda sahibinin kendi cihazından seçtiği resimler.
// Resimler hiçbir siteye yüklenmez: oda sahibinin tarayıcısında (IndexedDB) saklanır,
// oyun sırasında her oyuncuya sadece gördüğü kartlar doğrudan (PeerJS) gönderilir.
// Kart numaraları 100000'den başlar (fotoğraf numaralarıyla karışmasın).
// =============================================================

const Ozel = (() => {
  const ILK = 100000;
  const VT_AD = 'resimAvi', DEPO = 'kartlar';
  const resimler = new Map();   // kart no → data URL (oda sahibinde hepsi, misafirde sadece gelenler)
  let sahipSayisi = 0;          // bu cihazda kayıtlı kendi kart sayısı

  function vtAc() {
    return new Promise((ok, hata) => {
      const r = indexedDB.open(VT_AD, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(DEPO);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => hata(r.error);
    });
  }
  async function yukleKayitli() {
    try {
      const vt = await vtAc();
      const liste = await new Promise((ok, hata) => {
        const r = vt.transaction(DEPO).objectStore(DEPO).get('liste');
        r.onsuccess = () => ok(r.result || []);
        r.onerror = () => hata(r.error);
      });
      liste.forEach((veri, i) => resimler.set(ILK + i, veri));
      sahipSayisi = liste.length;
    } catch (e) { sahipSayisi = 0; }
    return sahipSayisi;
  }
  async function kaydet(liste) {
    const vt = await vtAc();
    await new Promise((ok, hata) => {
      const t = vt.transaction(DEPO, 'readwrite');
      t.objectStore(DEPO).put(liste, 'liste');
      t.oncomplete = ok;
      t.onerror = () => hata(t.error);
    });
  }

  // Seçilen dosyaları küçültür (uzun kenar 640 px, JPEG) ve saklar
  async function dosyalariAl(dosyalar, ilerleme) {
    const liste = [];
    const resimDosyalari = [...dosyalar].filter(f => /^image\//.test(f.type));
    for (let i = 0; i < resimDosyalari.length; i++) {
      try { liste.push(await kucult(resimDosyalari[i])); } catch (e) { /* bozuk dosya atlanır */ }
      ilerleme?.(i + 1, resimDosyalari.length);
    }
    for (let i = ILK; i < ILK + sahipSayisi; i++) resimler.delete(i);
    liste.forEach((veri, i) => resimler.set(ILK + i, veri));
    sahipSayisi = liste.length;
    await kaydet(liste);
    return liste.length;
  }
  function kucult(dosya) {
    return new Promise((ok, hata) => {
      const url = URL.createObjectURL(dosya);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); hata(new Error('resim açılamadı')); };
      img.src = url;
    });
  }
  async function temizle() {
    for (let i = ILK; i < ILK + sahipSayisi; i++) resimler.delete(i);
    sahipSayisi = 0;
    try { await kaydet([]); } catch (e) { /* yok */ }
  }

  return {
    ILK, yukleKayitli, dosyalariAl, temizle,
    get sayi() { return sahipSayisi; },
    deste: () => Array.from({ length: sahipSayisi }, (_, i) => ILK + i),
    ozelMi: k => k >= ILK,
    var: k => resimler.has(k),
    al: k => resimler.get(k),
    koy: (k, veri) => { if (k >= ILK && typeof veri === 'string' && veri.startsWith('data:image/')) resimler.set(k, veri); },
  };
})();

// Kart resmi adresi: kendi kartıysa cihazdaki resim, değilse fotoğraf arşivi
const resimAdresi = (id, en = 400) => {
  if (Ozel.ozelMi(id)) return Ozel.al(id) || 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  return `https://picsum.photos/id/${id}/${en}/${Math.round(en * 1.5)}`;
};
