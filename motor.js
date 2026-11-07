// =============================================================
// Resim Avı - oyun kuralları (oda sahibinin cihazında çalışır)
//   - Herkesin elinde 6 fotoğraf kartı var.
//   - Sırası gelen ANLATICI kartlarından birini seçer ve ona bir söz söyler.
//   - Diğerleri ellerinden o söze en uyan kartı gizlice atar.
//   - Kartlar karışık açılır; anlatıcı dışındakiler "anlatıcının kartı hangisi?" diye oy verir
//     (kendi kartına oy veremez).
//   - Puan: Herkes bulursa ya da kimse bulamazsa anlatıcı 0, diğerleri 2'şer alır.
//           Yoksa anlatıcı ve bulanlar 3'er alır.
//           Ayrıca kendi kartına gelen her oy için +1.
//   - Bitiş (açılışta seçilir): 20/30/40/50 puana ilk ulaşan ya da herkes 1/2/3 kez anlatınca.
// =============================================================

const Motor = (() => {
  const EL = 6;
  const SURE = { soz: 90, kart: 60, oy: 50, sonuc: 14 };
  let o = null, dinle = null, zaman = null;

  const karistir = a => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const olay = (tip, v = {}) => { try { dinle?.(tip, v); } catch (e) { console.error(e); } };
  const oyuncu = id => o?.oyuncular.find(p => p.id === id);
  const anlatici = () => o.oyuncular[o.anlaticiSira];
  const digerleri = () => o.oyuncular.filter(p => p !== anlatici());
  function zamanla(sn, f) {
    clearTimeout(zaman);
    o.bitis = Date.now() + sn * 1000;
    zaman = setTimeout(f, sn * 1000 + 1200);   // ağ için küçük pay
  }
  function kartCek() {
    if (!o.deste.length) o.deste = karistir(o.atilan.splice(0));
    return o.deste.pop();
  }
  function elleriDoldur() {
    o.oyuncular.forEach(p => { while (p.el.length < EL && (o.deste.length || o.atilan.length)) p.el.push(kartCek()); });
  }

  // oyuncular: [{ id, ad }], ayar: { bitis: 'puan' | 'tur', hedef: 20|30|40|50, kacKez: 1|2|3 }
  function yeni(oyuncular, dinleyici, ayar = {}) {
    clearTimeout(zaman);
    dinle = dinleyici;
    o = {
      oyuncular: oyuncular.map(p => ({ id: p.id, ad: p.ad, puan: 0, el: [], anlatti: 0 })),
      ayar: { bitis: ayar.bitis === 'tur' ? 'tur' : 'puan', hedef: [20, 30, 40, 50].includes(+ayar.hedef) ? +ayar.hedef : 30, kacKez: [1, 2, 3].includes(+ayar.kacKez) ? +ayar.kacKez : 2 },
      deste: karistir([...RESIMLER]), atilan: [],
      anlaticiSira: Math.floor(Math.random() * oyuncular.length),
      turNo: 0, asama: 'soz', soz: '', oynanan: {}, masa: [], oylar: {}, sonuc: null, bitis: 0,
      gecmis: [], kazananlar: [],
    };
    elleriDoldur();
    turBasla(true);
  }

  function bittiMi() {
    if (o.ayar.bitis === 'puan') return o.oyuncular.some(p => p.puan >= o.ayar.hedef);
    return o.oyuncular.every(p => p.anlatti >= o.ayar.kacKez);
  }

  function turBasla(ilk = false) {
    if (!ilk && bittiMi()) return oyunuBitir();
    o.turNo++;
    o.asama = 'soz';
    o.soz = '';
    o.oynanan = {};
    o.oylar = {};
    o.masa = [];
    o.sonuc = null;
    olay('soz', { anlatici: anlatici().id, turNo: o.turNo });
    zamanla(SURE.soz, () => {
      if (o.asama !== 'soz') return;
      // Anlatıcı süresinde söz söylemezse sıra sonrakine geçer
      anlatici().anlatti++;
      olay('sureDoldu', { anlatici: anlatici().id });
      o.asama = 'gecis';
      o.anlaticiSira = (o.anlaticiSira + 1) % o.oyuncular.length;
      zaman = setTimeout(() => turBasla(), 1800);
    });
  }

  // Anlatıcı kartını seçer ve sözünü söyler
  function sozVer(id, kart, metin) {
    const p = oyuncu(id);
    metin = String(metin ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!o || o.asama !== 'soz' || p !== anlatici() || !p.el.includes(kart) || !metin) return false;
    p.el.splice(p.el.indexOf(kart), 1);
    o.oynanan[id] = kart;
    o.soz = metin;
    o.asama = 'kart';
    olay('sozVerildi', { anlatici: id, soz: metin });
    zamanla(SURE.kart, () => {
      if (o.asama !== 'kart') return;
      // Süresinde atmayanların yerine rastgele kart atılır
      digerleri().filter(x => o.oynanan[x.id] === undefined && x.el.length).forEach(x => {
        const k = x.el[Math.floor(Math.random() * x.el.length)];
        x.el.splice(x.el.indexOf(k), 1);
        o.oynanan[x.id] = k;
      });
      oylamaBasla();
    });
    return true;
  }

  // Diğer oyuncular söze uyan kartı atar
  function kartAt(id, kart) {
    const p = oyuncu(id);
    if (!o || o.asama !== 'kart' || !p || p === anlatici() || o.oynanan[id] !== undefined || !p.el.includes(kart)) return false;
    p.el.splice(p.el.indexOf(kart), 1);
    o.oynanan[id] = kart;
    olay('kartAtildi', { id });
    if (digerleri().every(x => o.oynanan[x.id] !== undefined)) oylamaBasla();
    return true;
  }

  function oylamaBasla() {
    clearTimeout(zaman);
    o.masa = karistir(Object.values(o.oynanan));
    o.asama = 'oy';
    olay('oylama', {});
    zamanla(SURE.oy, () => o.asama === 'oy' && sonucla());
  }

  // Anlatıcının kartı hangisi? (kendi kartına oy verilmez)
  function oyVer(id, kart) {
    const p = oyuncu(id);
    if (!o || o.asama !== 'oy' || !p || p === anlatici() || o.oylar[id] !== undefined) return false;
    if (!o.masa.includes(kart) || o.oynanan[id] === kart) return false;
    o.oylar[id] = kart;
    olay('oyVerildi', { id });
    if (digerleri().every(x => o.oylar[x.id] !== undefined)) sonucla();
    return true;
  }

  function sonucla() {
    clearTimeout(zaman);
    const a = anlatici();
    const dogruKart = o.oynanan[a.id];
    const sahipler = {};
    Object.entries(o.oynanan).forEach(([id, k]) => (sahipler[k] = id));
    const bulanlar = digerleri().filter(x => o.oylar[x.id] === dogruKart).map(x => x.id);
    const kazanc = {};
    o.oyuncular.forEach(x => (kazanc[x.id] = 0));
    let durum;
    if (!bulanlar.length || bulanlar.length === digerleri().length) {
      durum = bulanlar.length ? 'herkes' : 'kimse';
      digerleri().forEach(x => (kazanc[x.id] += 2));
    } else {
      durum = 'normal';
      kazanc[a.id] += 3;
      bulanlar.forEach(id => (kazanc[id] += 3));
    }
    // Kandırma puanı: kendi kartına gelen her oy +1
    Object.entries(o.oylar).forEach(([id, k]) => {
      const sahip = sahipler[k];
      if (sahip && sahip !== a.id && sahip !== id) kazanc[sahip] += 1;
    });
    o.oyuncular.forEach(x => (x.puan += kazanc[x.id]));
    a.anlatti++;
    o.sonuc = { anlatici: a.id, dogruKart, sahipler, oylar: { ...o.oylar }, kazanc, durum, bulanlar };
    o.gecmis.push({ turNo: o.turNo, anlatici: a.id, soz: o.soz, kart: dogruKart, durum, bulanlar });
    o.atilan.push(...o.masa);
    elleriDoldur();
    o.asama = 'sonuc';
    olay('sonuc', { durum });
    zamanla(SURE.sonuc, devam);
  }

  // Sonuç ekranından sonraki tura geç (süre dolunca ya da oda sahibi "Devam" deyince)
  function devam() {
    if (!o || o.asama !== 'sonuc') return false;
    clearTimeout(zaman);
    o.anlaticiSira = (o.anlaticiSira + 1) % o.oyuncular.length;
    turBasla();
    return true;
  }

  function oyunuBitir() {
    clearTimeout(zaman);
    const enCok = Math.max(...o.oyuncular.map(p => p.puan));
    o.kazananlar = o.oyuncular.filter(p => p.puan === enCok).map(p => p.id);
    o.asama = 'bitti';
    o.bitis = 0;
    olay('bitti', { kazananlar: o.kazananlar });
  }

  // id numaralı oyuncu ne görür: sadece kendi eli; masadaki kartların sahipleri sonuçta açılır
  function gorunum(id) {
    if (!o) return null;
    const goster = o.asama === 'sonuc' || o.asama === 'bitti';
    return {
      asama: o.asama, turNo: o.turNo, anlatici: anlatici().id, soz: o.soz, bitis: o.bitis, ayar: o.ayar,
      el: [...(oyuncu(id)?.el || [])],
      benimKart: o.oynanan[id] ?? null,
      benimOy: o.oylar[id] ?? null,
      masa: o.asama === 'oy' || goster ? [...o.masa] : [],
      oyuncular: o.oyuncular.map(p => ({ id: p.id, ad: p.ad, puan: p.puan, anlatti: p.anlatti,
        oynadi: o.oynanan[p.id] !== undefined, oyVerdi: o.oylar[p.id] !== undefined })),
      sonuc: goster ? o.sonuc : null,
      // Anlatıcı oy vermediği için oylamada hangi kartı kimin attığını görebilir
      sahipler: o.asama === 'oy' && id === anlatici().id ? Object.fromEntries(Object.entries(o.oynanan).map(([pid, k]) => [k, pid])) : null,
      gecmis: o.gecmis, kazananlar: o.kazananlar,
    };
  }

  function oyuncuGuncelle(id, ad) { const p = oyuncu(id); if (p) p.ad = ad; }

  return {
    yeni, sozVer, kartAt, oyVer, devam, gorunum, oyuncuGuncelle, SURE, EL,
    temizle: () => { clearTimeout(zaman); o = null; },
    get aktif() { return !!o && o.asama !== 'bitti'; },
  };
})();
