// =============================================================
// Resim Avı - ekran: menü/bekleme odası, el, masa, oylama, sonuç, oyun sonu
// Karta dokununca büyük açılır; ne yapılacaksa (söz söyle / kartı at / oy ver) orada yapılır.
// =============================================================

const $ = id => document.getElementById(id);
const ANAHTAR_AD = 'resimAvi.ad';
const kayitOku = (a, v) => { try { return localStorage.getItem(a) ?? v; } catch (e) { return v; } };
const kayitYaz = (a, v) => { try { localStorage.setItem(a, v); } catch (e) { /* yok */ } };
const guvenli = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ui = { benimId: null, durum: null, lobi: null, ayar: null, secKart: null, sozTaslak: '', otomatikTur: 0, oniz: null, onizAnahtar: '' };

$('adim').value = kayitOku(ANAHTAR_AD, '');

// ---------- Bekleme odası ----------
function lobiGeldi(oyuncular, ayar, basladi) {
  ui.lobi = oyuncular;
  ui.ayar = ayar;
  if (basladi) return;
  ekranLobi();
}
function ekranLobi() {
  $('oyun').hidden = true;
  $('sonEkran').hidden = true;
  $('onizleme').hidden = true;
  $('menu').hidden = false;
  $('girisAlani').hidden = true;
  $('onlineDurum').innerHTML = '';
  $('lobi').hidden = false;
  const oy = ui.lobi || [];
  const ev = Ag.mod === 'ev';
  $('lobiListe').innerHTML = oy.map((p, i) => `<div class="oyuncu${p.id === ui.benimId ? ' ben' : ''}${p.bagli ? '' : ' kopuk'}">${i === 0 ? '👑 ' : ''}${guvenli(p.ad)}${p.id === ui.benimId ? ' <small>(sen)</small>' : ''}</div>`).join('')
    + Array.from({ length: Math.max(0, Ag.EN_AZ - oy.length) }, () => '<div class="bos">boş yer…</div>').join('');
  $('lobiSayi').textContent = `(${oy.length}/${Ag.EN_COK})`;
  $('lobiKod').innerHTML = `Oda kodu: <b>${guvenli($('odaBilgisi').textContent.replace('🔑 Oda ', ''))}</b><br><small>Arkadaşların bu kodu “Katıl” kısmına yazsın.</small>`;
  document.querySelectorAll('.ayarlar .secenek').forEach(s => {
    s.querySelectorAll('button').forEach(b => {
      b.classList.toggle('secili', String(ui.ayar?.[s.dataset.ayar]) === b.dataset.deger);
      b.disabled = !ev;
    });
  });
  // Seçilen bitişe göre sadece ilgili satır görünür
  document.querySelector('.secenek[data-ayar="hedef"]').hidden = ui.ayar?.bitis === 'tur';
  document.querySelector('.secenek[data-ayar="kacKez"]').hidden = ui.ayar?.bitis !== 'tur';
  $('ayarNotu').textContent = ev ? '' : '(oda sahibi seçer)';
  $('baslatBtn').hidden = !ev;
  const hazir = oy.length >= Ag.EN_AZ;
  $('baslatBtn').disabled = !hazir;
  $('baslatNot').textContent = hazir ? (ev ? 'Herkes geldiyse başlat!' : '⏳ Oda sahibinin başlatması bekleniyor…')
    : `Başlamak için en az ${Ag.EN_AZ} kişi lazım.`;
}
$('baslatBtn').addEventListener('click', () => Ag.oyunuBaslat());
document.querySelectorAll('.ayarlar .secenek').forEach(s => s.addEventListener('click', e => {
  const b = e.target.closest('button[data-deger]');
  if (!b || b.disabled) return;
  Ses.sec();
  const sayi = ['hedef', 'kacKez'].includes(s.dataset.ayar);
  Ag.lobiEylemGonder('ayar', { [s.dataset.ayar]: sayi ? +b.dataset.deger : b.dataset.deger });
}));

// ---------- Oyun durumu ----------
const benimOyuncu = () => ui.durum?.oyuncular.find(p => p.id === ui.benimId);
const adi = id => ui.durum?.oyuncular.find(p => p.id === id)?.ad ?? '';
const anlaticiyim = () => ui.durum && ui.durum.anlatici === ui.benimId;

function durumGeldi(d, olay) {
  const onceki = ui.durum;
  ui.durum = d;
  if (olay.tip === 'basla' || !onceki) {
    ui.secKart = null;
    ui.sozTaslak = '';
  }
  $('menu').hidden = true;
  $('oyun').hidden = false;
  const ben = anlaticiyim();
  switch (olay.tip) {
    case 'soz':
      ui.secKart = null;
      ui.sozTaslak = '';
      onizKapat();
      if (ben) {
        Ses.siraSende();
        mesaj('🗣️ Sıra sende! Bir kart seç, ona bir söz söyle', 'iri', 2600);
      } else mesaj(`🗣️ Anlatıcı: ${adi(d.anlatici)}`, '', 2000);
      break;
    case 'sozVerildi':
      Ses.kartAc?.(1);
      if (!ben) {
        Ses.siraSende();
        mesaj(`“${olay.soz}” → elinden en uyan kartı at!`, 'iri', 2600);
      }
      break;
    case 'kartAtildi':
      Ses.kartAt?.();
      break;
    case 'oylama':
      Ses.dagit?.();
      onizKapat();
      mesaj(ben ? '🗳️ Herkes senin kartını arıyor…' : '🗳️ Anlatıcının kartı hangisi?', 'iri', 2200);
      break;
    case 'oyVerildi':
      Ses.sec?.();
      break;
    case 'sonuc': {
      onizKapat();
      const k = d.sonuc?.kazanc?.[ui.benimId] || 0;
      k > 0 ? Ses.dogruCikti?.() : Ses.yalanCikti?.();
      mesaj(k > 0 ? `+${k} puan! 🎉` : 'Bu tur puan yok 😕', k > 0 ? 'iri' : 'kirmizi', 2200);
      break;
    }
    case 'sureDoldu':
      mesaj(`⏰ ${adi(olay.anlatici)} süresinde söz söylemedi, sıra geçti`, 'kirmizi', 2600);
      break;
    case 'bitti':
      setTimeout(sonuGoster, 1500);
      break;
    case 'geriDondu':
      if (d.asama === 'bitti') sonuGoster();
      break;
  }
  ciz();
}

const durumMetni = s => ({
  herkes: '😅 Herkes buldu! Çok kolaydı: anlatıcı 0, diğerleri 2 puan.',
  kimse: '🙈 Kimse bulamadı! Çok zordu: anlatıcı 0, diğerleri 2 puan.',
  normal: '🎯 Bazıları buldu! Anlatıcı ve bulanlar 3’er puan.',
}[s] || '');

function fotoHtml(k, ekSinif = '', ic = '', en = 300) {
  return `<button class="foto${ekSinif}" data-k="${k}"><img src="${resimAdresi(k, en)}" alt="" loading="lazy" draggable="false">${ic}</button>`;
}

function ciz() {
  const d = ui.durum;
  if (!d) return;
  const ben = anlaticiyim();
  const n = d.oyuncular.length;
  const bagli = id => !d.baglilar || d.baglilar.includes(id);
  // Puanlar
  $('puanlar').innerHTML = d.oyuncular.map(p => {
    const anl = p.id === d.anlatici;
    const ikon = anl ? '🗣️' : d.asama === 'kart' ? (p.oynadi ? '✅' : '⏳') : d.asama === 'oy' ? (p.oyVerdi ? '✅' : '⏳') : '';
    const kaz = d.asama === 'sonuc' && d.sonuc ? d.sonuc.kazanc[p.id] : 0;
    return `<span class="pOyuncu${anl ? ' anlatici' : ''}${p.id === ui.benimId ? ' ben' : ''}${bagli(p.id) ? '' : ' kopuk'}">${ikon} ${guvenli(p.ad)} <b>${p.puan}</b>${kaz ? `<span class="kazanc">+${kaz}</span>` : ''}</span>`;
  }).join('');
  // Durum yazısı
  const atan = d.oyuncular.filter(p => p.id !== d.anlatici && p.oynadi).length;
  const oyVeren = d.oyuncular.filter(p => p.oyVerdi).length;
  $('durumYazi').innerHTML =
    d.asama === 'soz' ? (ben ? '🗣️ <b>Sıra sende!</b> Elinden bir karta dokun, ona bir söz söyle.' : `🗣️ <b>${guvenli(adi(d.anlatici))}</b> bir kart seçip söz düşünüyor…`)
    : d.asama === 'kart' ? (ben ? `Diğerleri sözüne uyan kart arıyor… (${atan}/${n - 1})`
      : d.benimKart !== null ? `✅ Kartını attın. Diğerleri bekleniyor… (${atan}/${n - 1})` : '🃏 <b>Söze en uyan kartını at!</b> Elinden bir karta dokun.')
    : d.asama === 'oy' ? (ben ? `Herkes senin kartını arıyor… (${oyVeren}/${n - 1})`
      : d.benimOy !== null ? `✅ Oyunu verdin. Diğerleri bekleniyor… (${oyVeren}/${n - 1})` : '🗳️ <b>Anlatıcının kartı hangisi?</b> Karta dokun, oy ver.')
    : d.asama === 'sonuc' ? durumMetni(d.sonuc?.durum)
    : d.asama === 'bitti' ? '🏆 Oyun bitti!'
    : '…';
  // Hedef: kaç puan / kaçıncı tur
  if (d.asama !== 'bitti') {
    const yapilan = d.oyuncular.reduce((t, p) => t + p.anlatti, 0);
    $('durumYazi').innerHTML += d.ayar.bitis === 'tur'
      ? ` <small class="hedef">🔁 Tur ${Math.min(yapilan + (d.asama === 'sonuc' ? 0 : 1), n * d.ayar.kacKez)}/${n * d.ayar.kacKez}</small>`
      : ` <small class="hedef">🏁 ${d.ayar.hedef} puan</small>`;
  }
  // Söz
  $('sozKutusu').hidden = !d.soz;
  if (d.soz) $('sozKutusu').innerHTML = `<small>🗣️ ${guvenli(adi(d.anlatici))} diyor ki:</small><div class="soz">“${guvenli(d.soz)}”</div>`;
  // Masa
  let masa = '', masaBaslik = '';
  if (d.asama === 'kart') {
    masaBaslik = '🂠 Masaya atılan kartlar (kapalı)';
    masa = d.oyuncular.map(p => `<div class="foto arka${p.oynadi ? '' : ' bos'}">${p.oynadi ? '❓' : ''}</div>`).join('');
  } else if (d.asama === 'oy') {
    masaBaslik = ben ? '🃏 Masadaki kartlar: kimin hangisini attığını sadece sen görüyorsun' : '🃏 Masadaki kartlar: büyütmek için dokun';
    masa = d.masa.map((k, i) => {
      const sahip = d.sahipler?.[k];   // sadece anlatıcıya gelir
      const etiket = sahip ? `<span class="sahip">${sahip === ui.benimId ? '🗣️ Senin kartın' : guvenli(adi(sahip))}</span>` : `<span class="no">${i + 1}</span>`;
      return fotoHtml(k, `${k === d.benimKart && !sahip ? ' benim' : ''}${k === d.benimOy ? ' oyum' : ''}${sahip === ui.benimId ? ' dogru' : ''}`, etiket);
    }).join('');
  } else if ((d.asama === 'sonuc' || d.asama === 'bitti') && d.sonuc && d.masa.length) {
    masaBaslik = '🔎 Kim hangi kartı attı, kim nereye oy verdi?';
    const s = d.sonuc;
    masa = d.masa.map(k => {
      const sahip = s.sahipler[k];
      const oylar = Object.entries(s.oylar).filter(([, kk]) => kk === k).map(([id]) => `<i>${guvenli(adi(id))}</i>`).join('');
      return fotoHtml(k, k === s.dogruKart ? ' dogru' : '', `<span class="oylar">${oylar}</span><span class="sahip">${k === s.dogruKart ? '🗣️ ' : ''}${guvenli(adi(sahip))}</span>`);
    }).join('');
  }
  if ($('masa').dataset.html !== masa) { $('masa').dataset.html = masa; $('masa').innerHTML = masa; }
  $('masaBaslik').textContent = masaBaslik;
  // Sonuç alt bilgisi
  $('sonucAlt').hidden = d.asama !== 'sonuc';
  if (d.asama === 'sonuc') {
    const ev = Ag.mod === 'ev';
    $('sonucAlt').innerHTML = ev ? '<button id="devamBtn" class="buyuk">▶️ Sonraki tur</button>' : '<p class="not">⏳ Sıradaki tur birazdan başlıyor…</p>';
  }
  // El
  const el = d.el.map(k => fotoHtml(k, k === ui.secKart ? ' secili' : '')).join('');
  if ($('el').dataset.html !== el) { $('el').dataset.html = el; $('el').innerHTML = el; }
  $('elBaslik').textContent = d.asama === 'bitti' ? '' : '🖐️ Elin (sadece sen görüyorsun): büyütmek için dokun';
  // Geçmiş
  const gecmis = (d.gecmis || []).slice().reverse().map(g2 => `<button class="gcKart" data-k="${g2.kart}"><img src="${resimAdresi(g2.kart, 200)}" alt="" loading="lazy"><b>“${guvenli(g2.soz)}”</b>${guvenli(adi(g2.anlatici))}</button>`).join('');
  $('gecmisPaneli').hidden = !gecmis;
  if ($('gecmisListe').dataset.html !== gecmis) { $('gecmisListe').dataset.html = gecmis; $('gecmisListe').innerHTML = gecmis; }
  onizEylemCiz();
}

// ---------- Kartı büyük göster ----------
function onizAc(k, kaynak) {
  ui.oniz = { k, kaynak };
  ui.onizAnahtar = '';
  $('onizResim').src = resimAdresi(k, 600);
  $('onizleme').hidden = false;
  const d = ui.durum;
  if (kaynak === 'el' && d?.asama === 'soz' && anlaticiyim()) {
    ui.secKart = k;
    ciz();
  }
  onizEylemCiz();
  const inp = $('onizEylem').querySelector('input');
  if (inp && !matchMedia('(pointer: coarse)').matches) inp.focus();
}
function onizKapat() {
  ui.oniz = null;
  $('onizleme').hidden = true;
}
function onizEylemCiz() {
  const d = ui.durum, o = ui.oniz;
  if (!o || !d) return;
  const ben = anlaticiyim();
  let anahtar = 'yok', html = '';
  if (o.kaynak === 'el' && d.asama === 'soz' && ben) {
    anahtar = 'soz';
    html = `<input id="sozGir" maxlength="40" placeholder="Bu karta sözün ne?" autocomplete="off" value="${guvenli(ui.sozTaslak)}">
      <button id="sozGonderBtn" class="buyuk">📣 Bu kartla söyle</button>
      <p class="not">Bir kelime, cümle, şarkı adı… Ne çok kolay ne çok zor olsun!</p>`;
  } else if (o.kaynak === 'el' && d.asama === 'kart' && !ben && d.benimKart === null) {
    anahtar = 'kart';
    html = `<button id="kartAtBtn" class="buyuk">🃏 Bu kartı at</button><p class="not">Söz: “${guvenli(d.soz)}”</p>`;
  } else if (o.kaynak === 'masa' && d.asama === 'oy' && !ben && d.benimOy === null) {
    anahtar = o.k === d.benimKart ? 'kendi' : 'oy';
    html = o.k === d.benimKart ? '<p>Bu senin kartın, ona oy veremezsin 🙂</p>'
      : `<button id="oyVerBtn" class="buyuk">🗳️ Anlatıcının kartı bu!</button><p class="not">Söz: “${guvenli(d.soz)}”</p>`;
  } else if (o.kaynak === 'masa' && d.sonuc) {
    const s = d.sonuc;
    anahtar = 'sonuc' + d.turNo;
    html = `<p>${o.k === s.dogruKart ? '🗣️ Anlatıcının kartı' : '🃏 Atan'}: <b>${guvenli(adi(s.sahipler[o.k]))}</b></p>`;
  } else if (o.kaynak === 'gecmis') {
    const g2 = (d.gecmis || []).find(x => x.kart === o.k);
    anahtar = 'gecmis';
    if (g2) html = `<p>🗣️ ${guvenli(adi(g2.anlatici))}: <b>“${guvenli(g2.soz)}”</b><br><small>${durumMetni(g2.durum)}</small></p>`;
  }
  anahtar += `|${o.k}|${o.kaynak}`;
  if (anahtar === ui.onizAnahtar) return;
  ui.onizAnahtar = anahtar;
  $('onizEylem').innerHTML = html;
}
function sozGonder() {
  const d = ui.durum;
  const metin = ($('sozGir')?.value ?? ui.sozTaslak).trim();
  if (!metin) return mesaj('Önce sözünü yaz 🙂', 'kirmizi', 1500);
  if (ui.secKart === null) return;
  Ag.eylem('soz', ui.secKart, metin);
  ui.otomatikTur = d.turNo;
  Ses.sec();
  onizKapat();
}
$('onizEylem').addEventListener('input', e => { if (e.target.id === 'sozGir') ui.sozTaslak = e.target.value; });
$('onizEylem').addEventListener('keydown', e => { if (e.target.id === 'sozGir' && e.key === 'Enter') sozGonder(); });
$('onizEylem').addEventListener('click', e => {
  const o = ui.oniz;
  if (!o) return;
  if (e.target.id === 'sozGonderBtn') sozGonder();
  else if (e.target.id === 'kartAtBtn') { Ag.eylem('kart', o.k); Ses.kartAt?.(); onizKapat(); }
  else if (e.target.id === 'oyVerBtn') { Ag.eylem('oy', o.k); Ses.sec(); onizKapat(); }
});
$('onizKapat').addEventListener('click', onizKapat);
$('onizleme').addEventListener('click', e => { if (e.target.id === 'onizleme') onizKapat(); });

$('el').addEventListener('click', e => {
  const b = e.target.closest('.foto[data-k]');
  if (b) { Ses.sec(); onizAc(+b.dataset.k, 'el'); }
});
$('masa').addEventListener('click', e => {
  const b = e.target.closest('.foto[data-k]');
  if (b) { Ses.sec(); onizAc(+b.dataset.k, 'masa'); }
});
$('gecmisListe').addEventListener('click', e => {
  const b = e.target.closest('.gcKart[data-k]');
  if (b) onizAc(+b.dataset.k, 'gecmis');
});
$('sonucAlt').addEventListener('click', e => { if (e.target.id === 'devamBtn') Ag.eylem('devam'); });

// ---------- Mesaj, oyun sonu ----------
let mesajZamani = null;
function mesaj(yazi, sinif = '', sure = 2000) {
  const m = $('mesaj');
  m.textContent = yazi;
  m.className = 'goster ' + sinif;
  clearTimeout(mesajZamani);
  mesajZamani = setTimeout(() => (m.className = sinif), sure);
}

function sonuGoster() {
  const d = ui.durum;
  if (!d || d.asama !== 'bitti') return;
  const kazandim = d.kazananlar.includes(ui.benimId);
  if (kazandim) Ses.kazandin?.();
  $('sonBaslik').innerHTML = `🏆 Kazanan: ${d.kazananlar.map(id => guvenli(adi(id))).join(' & ')}${kazandim ? ' (sen!) 🎉' : ''}`;
  const MADALYA = ['🥇', '🥈', '🥉'];
  $('sonSiralama').innerHTML = d.oyuncular.slice().sort((a, b) => b.puan - a.puan).map((p, i) =>
    `<div class="sira${d.kazananlar.includes(p.id) ? ' kazanan' : ''}">${MADALYA[i] || '▫️'}<span>${guvenli(p.ad)}${p.id === ui.benimId ? ' (sen)' : ''}</span><b>${p.puan}</b></div>`).join('');
  $('galeri').innerHTML = d.gecmis.map(g2 => `<div class="galeriKart"><img src="${resimAdresi(g2.kart, 260)}" alt="" loading="lazy"><b>“${guvenli(g2.soz)}”</b>${guvenli(adi(g2.anlatici))} · ${g2.durum === 'normal' ? `${g2.bulanlar.length} kişi buldu` : g2.durum === 'herkes' ? 'herkes buldu' : 'kimse bulamadı'}</div>`).join('') || '<p class="not">Hiç tur oynanmadı.</p>';
  const ev = Ag.mod === 'ev';
  $('lobiyeDonBtn').hidden = !ev;
  $('sonBekle').hidden = ev;
  $('sonEkran').hidden = false;
}
$('lobiyeDonBtn').addEventListener('click', () => Ag.lobiyeDon());
$('sonKapatBtn').addEventListener('click', () => ($('sonEkran').hidden = true));
$('menuBtn').addEventListener('click', () => {
  if (confirm(Ag.mod === 'ev' ? 'Odayı kapatıp ana menüye dönülsün mü? (Arkadaşlarının oyunu da biter)' : 'Odadan çıkılsın mı? (Aynı adla geri girebilirsin)')) Ag.ayril();
});
function sesDugmesi() { $('sesBtn').textContent = Ses.acik ? '🔊' : '🔇'; }
$('sesBtn').addEventListener('click', () => { Ses.ac(!Ses.acik); sesDugmesi(); });
sesDugmesi();

// Süre çubuğu, son saniyeler tik-tak, süre dolunca anlatıcının yazdığı söz kendiliğinden gider
setInterval(() => {
  const d = ui.durum;
  if (!d) return;
  const toplam = Motor.SURE[d.asama];
  const oran = toplam && d.bitis ? Math.max(0, Math.min(1, (d.bitis - Date.now()) / (toplam * 1000))) : 0;
  $('sure').style.width = `${oran * 100}%`;
  const ben = anlaticiyim();
  const isimVar = (d.asama === 'soz' && ben) || (d.asama === 'kart' && !ben && d.benimKart === null) || (d.asama === 'oy' && !ben && d.benimOy === null);
  if (isimVar && oran > 0 && oran < 0.15 && Math.round(Date.now() / 250) % 4 === 0) Ses.tikTak?.();
  if (d.asama === 'soz' && ben && Date.now() >= d.bitis - 300 && ui.otomatikTur !== d.turNo) {
    ui.otomatikTur = d.turNo;
    if (ui.secKart !== null && ui.sozTaslak.trim()) {
      Ag.eylem('soz', ui.secKart, ui.sozTaslak.trim());
      onizKapat();
      mesaj('⏰ Süre doldu! Yazdığın söz gönderildi', '', 2400);
    }
  }
}, 250);
