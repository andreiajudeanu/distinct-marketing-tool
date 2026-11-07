// Deterministic stand-ins for the local demo shop. Results carry the SIMULAT label.
// They are never used for a real site: a failed search must stay a visible failure.

export const isDemoUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(url ?? '');

export function discoveryMode(url, aiAvailable) {
  if (isDemoUrl(url)) return 'simulated';
  return aiAvailable ? 'live' : 'unavailable';
}

export function experimentMode(evidence, aiAvailable) {
  if (aiAvailable) return 'live';
  return evidence.every((item) => isDemoUrl(item.url)) ? 'simulated' : 'unavailable';
}

export function simulatedCandidates(base) {
  return [
    { url: `${base}/demo/rival-a`, title: 'Casa de Parfum', why: 'Vinde parfumuri nișă de 50 ml.' },
    { url: `${base}/demo/rival-b`, title: 'Nota Lemnoasă', why: 'Vinde parfumuri lemnoase de 50 ml.' },
    { url: `${base}/demo/rival-c`, title: 'Esență Rară', why: 'Vinde parfumuri nișă.' },
    { url: `${base}/demo/marketplace`, title: 'Piața Mare', why: 'Listare de parfum cu mai mulți vânzători.' },
    { url: `${base}/demo/foreign`, title: 'Maison Lumen', why: 'Parfumuri similare, altă piață.' },
  ];
}

export function simulatedExperiment({ evidence, capabilities }) {
  const first = evidence[0];
  const claims = evidence.map((item) => ({
    text: `${item.rival}: „${item.after ?? item.before}”.`,
    evidenceId: item.id,
  }));
  const shared = {
    guardrailMetric: 'Valoarea medie a comenzii',
    stopCondition: 'Oprești dacă valoarea medie a comenzii scade cu peste 10% după două săptămâni complete.',
    claims,
  };

  if (first.type === 'bundle_sample') {
    return {
      ...shared,
      summary: 'Testează un set de mostre pentru cei care nu cumpără flaconul fără să încerce parfumul.',
      hypothesis: 'Dacă oferim un set de mostre pe pagină, mai mulți vizitatori nehotărâți vor face o primă comandă.',
      requires: ['samples'],
      discountPct: 0,
      headline: 'Încearcă înainte să alegi',
      body: 'Setul de 3 mostre de 2 ml îți arată cum evoluează parfumul pe pielea ta.',
      cta: 'Adaugă setul de mostre',
      primaryMetric: 'Rata de adăugare în coș a setului de mostre',
    };
  }
  if (first.type === 'shipping' && capabilities.freeShipping) {
    return {
      ...shared,
      summary: 'Testează afișarea pragului de livrare gratuită lângă preț.',
      hypothesis: 'Dacă pragul e vizibil lângă preț, mai mulți vizitatori vor finaliza comanda.',
      requires: ['freeShipping'],
      discountPct: 0,
      headline: 'Livrare gratuită',
      body: 'Vezi pragul de livrare gratuită înainte să adaugi în coș.',
      cta: 'Adaugă în coș',
      primaryMetric: 'Rata de finalizare a comenzii',
    };
  }
  return {
    ...shared,
    summary: 'Testează un mesaj clar care răspunde schimbării observate.',
    hypothesis: 'Dacă oferta noastră e mai clară pe pagină, mai mulți vizitatori vor adăuga produsul în coș.',
    requires: [],
    discountPct: 0,
    headline: 'De ce să alegi acest parfum',
    body: 'Spune clar ce primește clientul și cum poate returna produsul.',
    cta: 'Adaugă în coș',
    primaryMetric: 'Rata de adăugare în coș',
  };
}
