// Pure views for the results page: job state in, HTML out.

import { icon } from './icons.js';
import {
  analysisPill, avatar, emptyState, esc, external, group, hero, host, pill, safeUrl, stepsView, when,
} from './views.js';

const COMPETITOR_TYPES = {
  direct: ['Competitor direct', 'ok'],
  indirect: ['Competitor indirect', 'warn'],
  visual_reference: ['Referință vizuală', ''],
};

const COMPETITOR_MARKETS = {
  confirmed: ['Piață confirmată', 'ok', 'check'],
  unconfirmed: ['Piață neconfirmată', 'warn', 'alert'],
};

const SKIPPED = {
  blocked: ['Blocată', 'bad', 'lock'],
  unavailable: ['Pagină indisponibilă', 'bad', 'alert'],
  robots: ['Interzis prin robots.txt', 'warn', 'lock'],
  unsafe: ['Adresă nepermisă', 'bad', 'shield'],
  failed: ['Nu s-a încărcat', 'warn', 'alert'],
  not_competitor: ['Necomparabil', 'warn', 'close'],
  other_market: ['Altă piață', 'warn', 'radar'],
  unverified: ['Neverificat', 'warn', 'alert'],
};

const MARKET_STATUS = {
  detected: ['Dedusă din semnale', 'ok', 'check'],
  unconfirmed: ['Piață neconfirmată', 'warn', 'alert'],
  corrected: ['Corectată de tine', 'ok', 'check'],
  unknown: ['Necunoscută', 'warn', 'alert'],
};

const PRIORITIES = {
  high: ['Prioritate mare', 'bad'],
  medium: ['Prioritate medie', 'warn'],
  low: ['Prioritate mică', ''],
};

export const SECTIONS = [
  { id: 'rezumat', label: 'Rezumat', icon: 'bag' },
  { id: 'competitori', label: 'Rivali', icon: 'radar' },
  { id: 'comparatie', label: 'Compară', icon: 'eye' },
  { id: 'recomandari', label: 'Sfaturi', icon: 'spark' },
];

const SAFE_IMAGE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const SAFE_COLOR = /^#[0-9a-f]{6}$/i;

const labelled = (table, key) => {
  const [text, kind, iconName] = table[key] ?? [key, '', ''];
  return pill(text, kind, iconName);
};

function countryName(code) {
  if (!code) return 'Necunoscută';
  try {
    return new Intl.DisplayNames(['ro'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

const dash = (value) => esc(value || 'Necitit');

function citations(ids) {
  return ids.map((id) => `<a class="cite" href="#${esc(id)}" aria-label="Dovada ${esc(id)}">${esc(id)}</a>`).join('');
}

function claimList(title, claims) {
  if (!claims.length) return '';
  const items = claims.map((claim) => `<li><span>${esc(claim.text)}</span><span class="cites">${citations(claim.evidence_ids)}</span></li>`).join('');
  return `<h4>${esc(title)}</h4><ul class="claims">${items}</ul>`;
}

function shot(src, alt) {
  if (!src || !SAFE_IMAGE.test(src)) return `<p class="shot-missing">${icon('eye')}<span>Captură necitită</span></p>`;
  return `<img class="shot" src="${src}" alt="${esc(alt)}">`;
}

function chips(items) {
  return items.length ? `<div class="pills">${items.map((item) => pill(item)).join('')}</div>` : '<p class="meta">Necitit</p>';
}

function swatches(colors) {
  const valid = colors.filter((color) => SAFE_COLOR.test(color));
  if (!valid.length) return '<p class="meta">Paletă necitită</p>';
  return `<div class="swatches">${valid.map((color) =>
    `<span class="swatch"><i style="background:${color}"></i>${esc(color)}</span>`).join('')}</div>`;
}

function fact(label, value, note = '') {
  return `<div><dt>${esc(label)}</dt><dd>${value}${note ? `<span class="sub">${esc(note)}</span>` : ''}</dd></div>`;
}

function inferred(field) {
  if (!field || field.status === 'unknown' || !field.value) return 'Necitit';
  return `${esc(field.value)} ${pill('Dedus')}`;
}

function summarySection(result) {
  const { profile } = result;
  if (!profile) return '';
  const facts = `<dl class="facts">
    ${fact('Domeniu', external(profile.url, profile.domain))}
    ${fact('Categorie', inferred(profile.category))}
    ${fact('Produse sau servicii', dash(profile.products.join(', ')))}
    ${fact('Propunere de valoare', inferred(profile.value_proposition), profile.value_proposition.basis)}
    ${fact('Public țintă', inferred(profile.target_audience), profile.target_audience.basis)}
  </dl>`;
  return group('Rezumatul site-ului', `<div class="card-body">${facts}</div>`,
    'Ce e marcat „Dedus” e o interpretare, nu un fapt verificat.');
}

function marketSection(result) {
  const { market } = result;
  if (!market) return '';
  const signals = market.signals.map((signal) =>
    `<li>${pill(signal.strength === 'weak' ? 'Semnal slab' : signal.strength === 'strong' ? 'Semnal puternic' : 'Semnal mediu')}<span>${esc(signal.kind)}: ${esc(signal.value)}</span></li>`).join('');
  return group('Piața țintă', `<div class="card-body market">
    <div class="market-head"><strong class="market-name">${esc(countryName(market.country_code))}</strong>${labelled(MARKET_STATUS, market.status)}</div>
    <p class="meta">${esc(market.note)}</p>
    ${signals ? `<details><summary>${icon('chevron')}Semnale găsite</summary><ul class="signals">${signals}</ul></details>` : ''}
    <div class="market-form">
      <label><span>Țară, două litere</span>
        <input type="text" id="market-country" maxlength="2" autocomplete="off" value="${esc(market.country_code)}"></label>
      <label><span>Limbă, două litere</span>
        <input type="text" id="market-language" maxlength="2" autocomplete="off" value="${esc(market.language)}"></label>
    </div>
  </div>`, 'Corectează câmpurile, apoi apasă butonul rotund de jos. Reluăm căutarea pentru noua piață.');
}

function competitorCard(item) {
  const types = labelled(COMPETITOR_TYPES, item.category);
  const sources = item.source_urls.map((url) => `<li>${external(url, host(url))}</li>`).join('');
  return `<article class="surface competitor">
    ${shot(item.screenshot_data_url, `Prima pagină ${item.name}`)}
    <div class="competitor-body">
      <header class="card-head">${avatar(item.name)}
        <div class="row-main"><strong>${esc(item.name)}</strong>${external(item.url, item.domain)}</div></header>
      <div class="pills">${types}${labelled(COMPETITOR_MARKETS, item.market_status)}</div>
      <p>${esc(item.why_relevant)}</p>
      <p class="cites">${citations(item.evidence_ids.slice(0, 4))}</p>
      <details><summary>${icon('chevron')}Mesaje și oferte</summary>
        <dl class="facts">
          ${fact('Titluri', dash(item.content.headlines.slice(0, 4).join(' · ')))}
          ${fact('Butoane', dash(item.content.ctas.slice(0, 4).join(' · ')))}
          ${fact('Propuneri de valoare', dash(item.content.value_propositions.join(' · ')))}
          ${fact('Categorii', dash(item.content.product_categories.join(' · ')))}
          ${fact('Prețuri vizibile', dash(item.content.pricing_position))}
          ${fact('Structura paginii', dash(item.content.page_structure.slice(0, 6).join(' · ')))}
        </dl>
      </details>
      ${sources ? `<details><summary>${icon('chevron')}Surse</summary><ul class="sources">${sources}</ul></details>` : ''}
    </div>
  </article>`;
}

function competitorsSection(result, finished) {
  const { competitors, skipped } = result;
  const skippedRows = skipped.map((item) => `<li class="row list-row">${avatar(item.domain)}
    <div class="row-main"><strong>${esc(item.domain)}</strong><span class="sub">${esc(item.reason)}</span></div>
    ${labelled(SKIPPED, item.status)}</li>`).join('');
  const found = result.candidates_found
    ? `${competitors.length} competitori verificați din ${result.candidates_found} candidați găsiți automat.` : '';
  const body = competitors.length
    ? `<div class="competitor-grid">${competitors.map(competitorCard).join('')}</div>`
    : finished ? emptyState('Niciun competitor verificat', 'Nu inventăm competitori. Vezi mai jos ce s-a întâmplat.') : '';
  return `<section class="group-wrap" id="competitori">
    <h2 class="group-title">Competitori găsiți automat</h2>
    ${found ? `<p class="group-footer lead">${esc(found)}</p>` : ''}
    ${body}
    ${skippedRows ? `<details class="surface skipped"><summary>${icon('chevron')}Site-uri excluse sau blocate (${skipped.length})</summary>
      <ul>${skippedRows}</ul></details>` : ''}
  </section>`;
}

function positioningSection(result) {
  if (!result.positioning.length && !result.positioning_summary) return '';
  const names = new Map(result.competitors.map((item) => [item.domain, item.name]));
  const cards = result.positioning.map((entry) => `<article class="surface card">
    <strong>${esc(names.get(entry.domain) ?? entry.domain)}</strong>
    ${claimList('Asemănări', entry.similarities)}${claimList('Diferențe', entry.differences)}
  </article>`).join('');
  return `<section class="group-wrap" id="comparatie">
    <h2 class="group-title">Comparația mesajelor</h2>
    ${result.positioning_summary ? `<p class="surface lede">${esc(result.positioning_summary)}</p>` : ''}
    <div class="compare-grid">${cards}</div>
  </section>`;
}

function visualSection(result) {
  if (!result.visual.length) return '';
  const byDomain = new Map(result.competitors.map((item) => [item.domain, item]));
  const own = result.own_content;
  const ownCard = `<article class="surface card">
    <strong>Site-ul tău</strong>
    ${shot(result.own_screenshot_data_url, 'Prima pagină a site-ului tău')}
    ${swatches(own?.palette ?? [])}
  </article>`;
  const cards = result.visual.map((entry) => {
    const item = byDomain.get(entry.domain);
    return `<article class="surface card">
      <strong>${esc(item?.name ?? entry.domain)}</strong>
      ${swatches(item?.content.palette ?? [])}
      <p class="meta">${dash(entry.layout)}</p>
      ${claimList('Se aseamănă', entry.similarities)}${claimList('Diferă', entry.differences)}
    </article>`;
  }).join('');
  return `<section class="group-wrap">
    <h2 class="group-title">Observații vizuale</h2>
    <p class="group-footer lead">Separate de relevanța comercială. Sunt descrieri ale capturilor, nu măsurători.</p>
    <div class="compare-grid">${ownCard}${cards}</div>
  </section>`;
}

function recommendationCard(item, index) {
  const example = [item.example_headline, item.example_cta].filter(Boolean);
  const assumptions = item.assumptions.map((text) => `<li>${icon('alert')}<span>${esc(text)}</span></li>`).join('');
  return `<article class="surface card recommendation">
    <div class="rec-head"><span class="rec-number" aria-hidden="true">${index + 1}</span>
      <h3>${esc(item.problem)}</h3></div>
    <div class="pills">${labelled(PRIORITIES, item.priority)}</div>
    <p class="cites">${citations(item.evidence_ids)}</p>
    <dl class="facts">
      ${fact('Oportunitate', esc(item.opportunity))}
      ${fact('Ce schimbi pe site', esc(item.website_change))}
      ${fact('Beneficiu așteptat, ipoteză de testat', esc(item.expected_benefit_hypothesis))}
    </dl>
    ${example.length ? `<div class="variant"><i class="handle tl"></i><i class="handle tr"></i><i class="handle bl"></i><i class="handle br"></i>
      ${item.example_headline ? `<strong>${esc(item.example_headline)}</strong>` : ''}
      ${item.example_cta ? `<span class="variant-cta">${esc(item.example_cta)}</span>` : ''}</div>` : ''}
    ${assumptions ? `<h4>Presupuneri de verificat</h4><ul class="assumptions">${assumptions}</ul>` : ''}
  </article>`;
}

function recommendationsSection(result, finished) {
  const body = result.recommendations.length
    ? result.recommendations.map(recommendationCard).join('')
    : finished ? emptyState('Nicio recomandare', 'Scriem recomandări doar când există dovezi salvate.') : '';
  return `<section class="group-wrap" id="recomandari">
    <h2 class="group-title">Trei recomandări prioritizate</h2>
    ${body}
    ${result.recommendations.length ? '<p class="group-footer">Ce observi la un competitor e un semnal de investigat, nu dovadă că i-au crescut vânzările.</p>' : ''}
  </section>`;
}

function evidenceSection(result) {
  if (!result.evidence.length) return '';
  const rows = result.evidence.map((item) => `<li id="${esc(item.id)}">
    <span class="cite static">${esc(item.id)}</span>
    <span class="row-main"><span>${esc(item.quote)}</span>
    <span class="sub">${esc(item.field)} · ${esc(when(item.captured_at))}</span>
    ${external(item.url, item.domain)}</span></li>`).join('');
  return `<section class="group-wrap">
    <details class="surface skipped"><summary>${icon('chevron')}Toate dovezile (${result.evidence.length})</summary>
      <ul class="evidence-list">${rows}</ul></details>
  </section>`;
}

function notices(job) {
  const errors = job.errors.map((error) => `<p class="banner" role="alert">${icon('alert')}<span>${esc(error.message)}</span></p>`);
  const warnings = job.warnings.map((text) => `<p class="banner">${icon('alert')}<span>${esc(text)}</span></p>`);
  return [...errors, ...warnings].join('');
}

export function missingView(message) {
  return `${hero({ tone: 'aqua', object: 'lens', lines: ['Raport', 'indisponibil'], sub: message })}`;
}

export function reportView(job, { notice = '' } = {}) {
  const { result } = job;
  const finished = ['done', 'partial', 'failed'].includes(job.status);
  const name = result.profile?.business_name ?? 'Analizăm site-ul';
  return `
    ${hero({
      tone: 'aqua',
      object: 'lens',
      lines: ['Raportul', 'pieței tale'],
      sub: name,
      cta: `<div class="pills">${pill(job.label, job.label === 'LIVE' ? 'ok' : 'warn')}${analysisPill(job.status)}</div>`,
    })}
    ${notice ? `<p class="banner" role="alert">${icon('alert')}<span>${esc(notice)}</span></p>` : ''}
    ${notices(job)}
    ${finished ? '' : `<section class="surface card" aria-live="polite"><strong>Progres</strong>${stepsView(job.steps)}
      <p class="meta">Poți închide panoul. Analiza continuă pe server.</p></section>`}
    <section id="rezumat">${summarySection(result)}${marketSection(result)}</section>
    ${competitorsSection(result, finished)}
    ${positioningSection(result)}
    ${visualSection(result)}
    ${recommendationsSection(result, finished)}
    ${evidenceSection(result)}
    ${finished ? `<details class="surface skipped"><summary>${icon('chevron')}Cum a decurs analiza</summary>${stepsView(job.steps)}</details>` : ''}`;
}

export function dockView(job, busy, active) {
  const items = SECTIONS.map((section, index) => `<button type="button" data-section="${section.id}"
    ${index === active ? 'aria-current="true"' : ''}>${icon(section.icon)}<span>${section.label}</span></button>`);
  const running = job && !['done', 'partial', 'failed'].includes(job.status);
  const fab = `<button type="button" class="fab" data-action="rerun" aria-label="Reanalizează piața" ${busy || running || !job ? 'disabled' : ''}>
    ${busy || running ? '<span class="spinner" aria-hidden="true"></span>' : icon('refresh')}</button>`;
  return `${items.slice(0, 2).join('')}${fab}${items.slice(2).join('')}`;
}

export { safeUrl };
