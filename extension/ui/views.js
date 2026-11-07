import { CHANGE_LABELS } from '../lib/rules.js';
import { icon } from './icons.js';

export const TABS = [
  { id: 'product', label: 'Produs', icon: 'bag' },
  { id: 'market', label: 'Piață', icon: 'radar' },
  { id: 'changes', label: 'Schimbări', icon: 'pulse' },
  { id: 'experiments', label: 'Teste', icon: 'flask' },
];

export const TITLES = {
  product: 'Produsul tău',
  market: 'Piața ta',
  changes: 'Schimbări',
  experiments: 'Experimente',
};

const STATUS = {
  rival: ['Rival comparabil', 'ok', 'check'],
  marketplace: ['Reper de piață', 'warn', 'tag'],
  other_market: ['Altă piață', 'warn', 'radar'],
  unconfirmed_market: ['Piață neconfirmată', 'warn', 'alert'],
  not_comparable: ['Necomparabil', 'bad', 'close'],
  blocked: ['Blocată', 'bad', 'lock'],
  unavailable: ['Pagină indisponibilă', 'bad', 'alert'],
};

const CHANGE_ICONS = {
  price: 'tag',
  discount: 'percent',
  bundle_sample: 'gift',
  shipping: 'truck',
  returns: 'shield',
  stock: 'box',
  message: 'text',
};

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export const when = (iso) => (iso ? new Date(iso).toLocaleString('ro-RO', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
}) : 'niciodată');

export const safeUrl = (url) => (/^https?:\/\//.test(url) ? esc(url) : '#');

export const host = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const dataLabel = (url) => (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(url) ? 'SIMULAT' : 'LIVE');

export const pill = (text, kind = '', iconName = '') =>
  `<span class="pill ${kind}">${iconName ? icon(iconName) : ''}${esc(text)}</span>`;

const statusPill = (status) => {
  const [text, kind, iconName] = STATUS[status] ?? [status, '', ''];
  return pill(text, kind, iconName);
};

export const external = (url, text) =>
  `<a class="link" href="${safeUrl(url)}" target="_blank" rel="noreferrer">${icon('link')}<span>${esc(text)}</span></a>`;

const object3d = (name, className = '') =>
  `<img class="object ${className}" src="assets/3d/${name}.webp" alt="" width="420" height="420" draggable="false">`;

export function button(ui, { action, label, kind = 'tinted', iconName, data = {}, disabled = false, wide = false }) {
  const attrs = Object.entries(data).map(([key, value]) => `data-${key}="${esc(value)}"`).join(' ');
  const loading = ui.busy === action;
  return `<button type="button" class="btn ${kind} ${wide ? 'wide' : ''}" data-action="${action}" ${attrs}
    ${disabled || ui.busy ? 'disabled' : ''} ${loading ? 'aria-busy="true"' : ''}>
    ${loading ? '<span class="spinner" aria-hidden="true"></span>' : iconName ? icon(iconName) : ''}<span>${esc(label)}</span>
  </button>`;
}

function ringButton(ui, action, label) {
  const loading = ui.busy === action;
  return `<button type="button" class="ring-cta" data-action="${action}" ${ui.busy ? 'disabled' : ''} ${loading ? 'aria-busy="true"' : ''}>
    <span class="ring"><svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="33"/></svg>
      <span class="ring-core">${loading ? '<span class="spinner" aria-hidden="true"></span>' : icon('chevron')}</span></span>
    <span>${esc(label)}</span>
  </button>`;
}

export function hero({ tone, object, lines, sub, cta = '' }) {
  const title = lines.map(esc).join('<br>');
  return `<section class="hero hero-${tone}" data-tilt>
    ${object3d('spark', 'deco deco-a')}
    <span class="plus plus-a" aria-hidden="true">${icon('plus')}</span>
    <span class="plus plus-b" aria-hidden="true">${icon('plus')}</span>
    ${object3d(object, 'hero-object')}
    <h1>${title}</h1>
    <p>${esc(sub)}</p>
    ${cta}
  </section>`;
}

export function emptyState(title, body) {
  return `<div class="empty">${object3d('bot', 'empty-object')}
    <h2>${esc(title)}</h2><p>${esc(body)}</p></div>`;
}

export function group(title, rows, footer = '') {
  return `<section class="group-wrap">
    ${title ? `<h2 class="group-title">${esc(title)}</h2>` : ''}
    <div class="surface group">${rows}</div>
    ${footer ? `<p class="group-footer">${esc(footer)}</p>` : ''}
  </section>`;
}

function textRow(own, name, label) {
  return `<label class="row"><span>${label}</span>
    <input type="text" data-own="${name}" value="${esc(own[name])}" autocomplete="off"></label>`;
}

function numberRow(caps, name, label, unit = '') {
  return `<label class="row"><span>${label}</span>
    <span class="field"><input type="number" min="0" inputmode="decimal" data-cap="${name}" value="${esc(caps[name])}" placeholder="0">
    ${unit ? `<span class="unit">${unit}</span>` : ''}</span></label>`;
}

function switchRow(caps, name, label, iconName, tone) {
  return `<label class="row switch-row"><span class="row-label"><span class="tile tone-${tone}">${icon(iconName)}</span>${label}</span>
    <input class="switch" type="checkbox" role="switch" data-cap="${name}" ${caps[name] ? 'checked' : ''}></label>`;
}

const STEP_STATES = {
  pending: ['clock', 'În așteptare'],
  running: ['', 'În lucru'],
  done: ['check', 'Gata'],
  failed: ['close', 'Eșuat'],
  skipped: ['minus', 'Omis'],
};

export function stepsView(steps) {
  const rows = steps.map((step) => {
    const [iconName, text] = STEP_STATES[step.state] ?? STEP_STATES.pending;
    const mark = iconName ? icon(iconName) : '<span class="spinner" aria-hidden="true"></span>';
    return `<li class="step ${esc(step.state)}">${mark}
      <span class="step-text"><strong>${esc(step.label)}</strong>
      <span class="sub">${esc(step.detail || text)}</span></span></li>`;
  }).join('');
  return `<ol class="steps">${rows}</ol>`;
}

const ANALYSIS_STATUS = {
  queued: ['În așteptare', '', 'clock'],
  running: ['În lucru', '', 'clock'],
  done: ['Gata', 'ok', 'check'],
  partial: ['Rezultat parțial', 'warn', 'alert'],
  failed: ['Eșuat', 'bad', 'close'],
  expired: ['Expirată', 'warn', 'clock'],
};

export const analysisPill = (status) => {
  const [text, kind, iconName] = ANALYSIS_STATUS[status] ?? [status, '', ''];
  return pill(text, kind, iconName);
};

function analysisCard(analysis) {
  if (!analysis) return '';
  const notes = (analysis.errors ?? []).map((error) =>
    `<p class="banner">${icon('alert')}<span>${esc(error.message)}</span></p>`).join('');
  const labelPill = analysis.label ? pill(analysis.label) : '';
  const running = ['queued', 'running'].includes(analysis.status);
  return `<section id="analysis-card" class="surface card" aria-live="polite">
    <header class="card-head"><span class="tile tone-aqua">${icon('radar')}</span>
      <div class="row-main"><strong>Analiza site-ului</strong><span class="sub">${esc(host(analysis.url))}</span></div></header>
    <div class="pills">${analysisPill(analysis.status)}${labelPill}</div>
    ${notes}${running ? stepsView(analysis.steps ?? []) : ''}
  </section>`;
}

export const updateAnalysisCard = analysisCard;

function intro() {
  const steps = [
    ['lens', 'Găsim competitori', 'Automat, cu dovezi'],
    ['bell', 'Vezi schimbările', 'Cu dovadă înainte/după'],
    ['flask', 'Propunem un test', 'Doar cu ce poți oferi'],
  ];
  return `<section class="intro" aria-label="Cum funcționează">
    ${steps.map(([object, title, body]) => `<article class="surface intro-card">
      ${object3d(object, 'intro-object')}<strong>${title}</strong><span class="sub">${body}</span>
    </article>`).join('')}
  </section>`;
}

function analyzeButton(state, ui) {
  if (state.analysis) {
    const running = !['done', 'partial', 'failed', 'expired'].includes(state.analysis.status);
    return button(ui, { action: 'open-report', label: running ? 'Vezi progresul' : 'Vezi raportul', kind: 'cta', iconName: 'eye' });
  }
  return button(ui, { action: 'analyze', label: 'Analizează site-ul meu', kind: 'cta', iconName: 'radar' });
}

function productView(state, ui) {
  const { own, capabilities: caps } = state;
  if (!own) {
    return hero({
      tone: 'violet',
      object: 'bag',
      lines: ['Site-ul', 'tău'],
      sub: 'Deschide site-ul tău. Citim doar ce e public pe pagină și căutăm singuri competitorii.',
      cta: analyzeButton(state, ui),
    }) + analysisCard(state.analysis) + intro();
  }
  const secondary = state.analysis
    ? button(ui, { action: 'analyze', label: 'Analizează din nou', kind: 'plain', wide: true })
    : '';
  return `
    ${hero({
      tone: 'violet',
      object: 'bag',
      lines: ['Site-ul', 'tău'],
      sub: own.name,
      cta: analyzeButton(state, ui),
    })}
    ${analysisCard(state.analysis)}
    ${secondary}
    ${group('Ce poți oferi', `${switchRow(caps, 'samples', 'Mostre', 'gift', 'rose')}
      ${switchRow(caps, 'bundles', 'Pachete', 'box', 'orange')}
      ${switchRow(caps, 'freeShipping', 'Livrare gratuită', 'truck', 'aqua')}
      ${numberRow(caps, 'maxDiscountPct', 'Reducere maximă', '%')}`, 'Experimentele folosesc doar ce bifezi aici.')}
    ${group('Ce am citit', `${textRow(own, 'name', 'Produs')}${textRow(own, 'category', 'Categorie')}
      ${textRow(own, 'priceAmount', 'Preț')}${textRow(own, 'currency', 'Monedă')}
      ${textRow(own, 'country', 'Țară')}${textRow(own, 'lang', 'Limbă')}`, 'Corectează orice câmp greșit.')}
    ${group('Trafic', `${numberRow(caps, 'sessionsPerMonth', 'Sesiuni pe lună')}
      ${numberRow(caps, 'conversionPct', 'Conversie', '%')}`, 'Opțional. Calculează cât ar dura un test.')}
    ${button(ui, { action: 'discover', label: 'Caută doar pagini de produs', kind: 'plain', wide: true })}
    ${button(ui, { action: 'read-own', label: 'Recitește pagina', kind: 'plain', wide: true })}`;
}

function skeleton(count) {
  const rows = Array.from({ length: count }, () =>
    '<div class="skeleton-row"><span class="bone tile"></span><span class="bone line"></span></div>').join('');
  return `<div class="surface group" role="status" aria-label="Se încarcă">${rows}</div>`;
}

export function avatar(title) {
  const letter = (title || '?').trim().charAt(0).toUpperCase();
  const hue = [...(title || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
  return `<span class="avatar hue-${hue}" aria-hidden="true">${esc(letter)}</span>`;
}

function candidateRow(item) {
  return `<div class="row list-row">
    ${avatar(item.title)}
    <div class="row-main"><strong>${esc(item.title)}</strong><span class="sub">${esc(item.why)}</span>
    ${external(item.url, host(item.url))}</div>
  </div>`;
}

function rivalCard(item, index) {
  const reasons = item.reasons.map((reason) => `<li class="${reason.state}">
    ${icon({ ok: 'check', fail: 'close' }[reason.state] ?? 'alert')}
    <span>${esc(reason.criterion)}: ${esc(reason.evidence)}</span></li>`).join('');
  return `<article class="surface rival">
    <div class="rival-head">${avatar(item.title)}
      <input class="switch" type="checkbox" role="switch" data-select="${index}" ${item.selected ? 'checked' : ''}
        aria-label="Urmărește ${esc(item.title)}"></div>
    <strong>${esc(item.title)}</strong>
    <span class="sub">${esc(host(item.url))}</span>
    <div class="pills">${statusPill(item.status)}${pill(dataLabel(item.url))}</div>
    ${reasons ? `<details><summary>${icon('chevron')}De ce?</summary><ul class="reasons">${reasons}</ul></details>` : ''}
  </article>`;
}

function marketHero(state, ui, sub, cta = '') {
  return hero({ tone: 'aqua', object: 'lens', lines: ['Piața', 'ta'], sub, cta });
}

function marketView(state, ui) {
  if (ui.busy === 'discover' || ui.busy === 'read-candidates') {
    const text = ui.busy === 'discover' ? 'Caut pagini comparabile.' : 'Citesc paginile candidaților.';
    return `${marketHero(state, ui, text)}${skeleton(4)}`;
  }
  if (!state.candidates.length) {
    return `${marketHero(state, ui, 'Găsim magazine comparabile și îți arătăm de ce.')}
      ${emptyState('Încă nu urmărești piața', 'Pornește din ecranul Produs.')}`;
  }
  if (!state.classified.length) {
    return `${marketHero(state, ui, `${state.candidates.length} pagini găsite. Chrome îți poate cere permisiunea.`,
      button(ui, { action: 'read-candidates', label: 'Citește paginile', kind: 'cta', iconName: 'eye' }))}
      <div class="pills centered">${pill(state.discoveryLabel)}</div>
      ${group('Candidați', state.candidates.map(candidateRow).join(''))}`;
  }
  const indexed = state.classified.map((item, index) => ({ item, index }));
  const cards = (list) => `<div class="rival-grid">${list.map(({ item, index }) => rivalCard(item, index)).join('')}</div>`;
  const rivals = indexed.filter(({ item }) => item.status === 'rival');
  const others = indexed.filter(({ item }) => item.status !== 'rival');
  const selected = state.classified.filter((item) => item.selected).length;
  return `
    ${marketHero(state, ui, `${rivals.length} rivali comparabili, ${others.length} repere sau pagini excluse.`,
      button(ui, { action: 'track', label: `Urmărește selecția (${selected})`, kind: 'cta', iconName: 'check', disabled: !selected }))}
    ${rivals.length ? `<section class="group-wrap"><h2 class="group-title">Rivali comparabili</h2>${cards(rivals)}</section>` : ''}
    ${others.length ? `<section class="group-wrap"><h2 class="group-title">Repere și pagini excluse</h2>${cards(others)}
      <p class="group-footer">Le poți activa manual dacă le consideri relevante.</p></section>` : ''}`;
}

function changeCard(change, rival, rivalIndex, ui) {
  const confirmed = change.state === 'confirmed';
  return `<article class="surface card">
    <header class="card-head">
      <span class="tile tone-rose">${icon(CHANGE_ICONS[change.type] ?? 'text')}</span>
      <div class="row-main"><strong>${esc(CHANGE_LABELS[change.type] ?? change.type)}</strong><span class="sub">${esc(rival.title)}</span></div>
    </header>
    <div class="pills">
      ${confirmed ? pill('Confirmată', 'ok', 'check') : pill('De confirmat', 'warn', 'clock')}
      ${pill(dataLabel(change.url))}
    </div>
    <dl class="diff">
      <div class="before">${icon('minus')}<dt>Înainte</dt><dd>${esc(change.before ?? 'nimic')}</dd></div>
      <div class="after">${icon('plus')}<dt>După</dt><dd>${esc(change.after ?? 'eliminat')}</dd></div>
    </dl>
    <p class="meta">${esc(when(change.confirmedAt ?? change.firstSeenAt))}</p>
    ${external(change.url, host(change.url))}
    ${button(ui, { action: 'propose', label: 'Propune experiment', kind: 'cta', iconName: 'spark', wide: true, data: { rival: rivalIndex, change: change.id } })}
  </article>`;
}

function rivalIssue(rival) {
  if (rival.lastStatus === 'ok' && !rival.unread.length) return '';
  const unread = rival.unread.length ? `Necitit: ${rival.unread.join(', ')}. ` : '';
  return `<article class="surface card">
    <header class="card-head">${avatar(rival.title)}
      <div class="row-main"><strong>${esc(rival.title)}</strong><span class="sub">${esc(host(rival.url))}</span></div></header>
    <div class="pills">${rival.lastStatus === 'ok' ? pill('Date incomplete', 'warn', 'alert') : statusPill(rival.lastStatus)}${pill(dataLabel(rival.url))}</div>
    <p class="meta">${esc(unread)}Ultima observație reușită: ${esc(when(rival.lastOkAt))}.</p>
    ${external(rival.url, 'Deschide și verifică manual')}
  </article>`;
}

function changesView(state, ui) {
  if (!state.rivals.length) {
    return `${hero({ tone: 'arc', object: 'bell', lines: ['Ce s-a', 'schimbat'], sub: 'Alege rivali din ecranul Piață, apoi verifică.' })}
      ${emptyState('Niciun rival urmărit', 'Ai nevoie de cel puțin un rival.')}`;
  }
  const all = state.rivals.flatMap((rival) => [...rival.pending, ...rival.confirmed]);
  const types = [...new Set(all.map((change) => change.type))];
  const counts = types.map((type) => {
    const seen = state.rivals.filter((r) => [...r.pending, ...r.confirmed].some((c) => c.type === type)).length;
    return `<p class="summary"><span class="tile tone-aqua">${icon(CHANGE_ICONS[type] ?? 'text')}</span><span>${esc(CHANGE_LABELS[type])}: ${seen} din ${state.rivals.length} rivali urmăriți</span></p>`;
  }).join('');
  const cards = state.rivals.flatMap((rival, index) => [...rival.confirmed, ...rival.pending]
    .map((change) => changeCard(change, rival, index, ui))).join('');
  const last = state.rivals.map((rival) => rival.lastCheckedAt).sort().at(-1);
  return `
    ${hero({
      tone: 'arc',
      object: 'bell',
      lines: ['Ce s-a', 'schimbat'],
      sub: `Ultima verificare: ${when(last)}. Rulează doar cu Chrome deschis.`,
      cta: ringButton(ui, 'check', 'Verifică acum'),
    })}
    ${counts}
    ${cards || emptyState('Nicio schimbare relevantă', 'O schimbare se confirmă la a doua observație.')}
    ${state.rivals.map(rivalIssue).join('')}`;
}

function experimentsView(state, ui) {
  const heroBlock = hero({
    tone: 'paper',
    object: 'flask',
    lines: ['Teste', 'aprobate'],
    sub: 'Nimic nu a fost publicat în magazin.',
  });
  if (!state.approved.length) {
    return `${heroBlock}${emptyState('Niciun experiment aprobat', 'Pornește de la o schimbare din ecranul Schimbări.')}`;
  }
  const cards = state.approved.map((item, index) => `<article class="surface card">
    <header class="card-head"><span class="tile tone-aqua">${icon('flask')}</span>
      <div class="row-main"><strong>${esc(item.headline)}</strong><span class="sub">${esc(item.primaryMetric)}</span></div></header>
    <ul class="checks">
      <li>${icon('check')}<span>Ipoteză și metrici salvate</span></li>
      <li>${icon('check')}<span>${item.evidence.length} dovezi cu sursă</span></li>
      <li>${icon('clock')}<span>Reverifică oferta rivalului după ${esc(when(item.recheckAt))}</span></li>
    </ul>
    <div class="actions">
      ${button(ui, { action: 'brief', label: 'Brief', iconName: 'download', data: { index } })}
      ${button(ui, { action: 'block', label: 'Bloc', iconName: 'download', data: { index } })}
      ${button(ui, { action: 'visual', label: 'Vizual', iconName: 'spark', data: { index } })}
    </div></article>`).join('');
  return heroBlock + cards;
}

export function sheetView(draft, ui) {
  const blocked = !draft.check.ok;
  const duration = draft.duration
    ? `${draft.duration.weeks} săptămâni, ${draft.duration.perVariant} vizitatori pe variantă`
    : 'Completează sesiunile și conversia pentru un calcul.';
  const evidence = (draft.claims ?? []).map((claim) => {
    const source = draft.evidence.find((item) => item.id === claim.evidenceId);
    return `<li>${esc(claim.text)}${source ? external(source.url, host(source.url)) : ''}</li>`;
  }).join('');
  return `<div class="grabber" aria-hidden="true"></div>
    <header class="sheet-head">
      <h2 id="sheet-title">Experiment propus</h2>
      <button type="button" class="icon-btn" data-action="reject" aria-label="Respinge și închide">${icon('close')}</button>
    </header>
    <div class="pills">${pill(draft.label)}${blocked ? pill('Respins de reguli', 'bad', 'close') : pill('Trece regulile', 'ok', 'check')}</div>
    ${draft.check.errors.map((error) => `<p class="banner">${icon('alert')}<span>${esc(error)}</span></p>`).join('')}
    <div class="variant">
      <i class="handle tl"></i><i class="handle tr"></i><i class="handle bl"></i><i class="handle br"></i>
      ${object3d('flask', 'variant-object')}
      <strong>${esc(draft.headline)}</strong>
      <p>${esc(draft.body)}</p>
      <span class="variant-cta">${esc(draft.cta)}</span>
    </div>
    <p>${esc(draft.summary)}</p>
    <p class="caption">Semnal de investigat, nu dovadă că rivalilor le-au crescut vânzările.</p>
    <h3>Ipoteză</h3><p>${esc(draft.hypothesis)}</p>
    <h3>Măsurare</h3>
    <dl class="facts">
      <div><dt>Principală</dt><dd>${esc(draft.primaryMetric)}</dd></div>
      <div><dt>Control</dt><dd>${esc(draft.guardrailMetric)}</dd></div>
      <div><dt>Durată</dt><dd>${esc(duration)}</dd></div>
      <div><dt>Oprire</dt><dd>${esc(draft.stopCondition)}</dd></div>
    </dl>
    ${draft.duration?.tooLong ? `<p class="banner">${icon('clock')}<span>Testul depășește șase săptămâni. Alege o schimbare mai mare sau un test înainte/după, cu limitele lui.</span></p>` : ''}
    <h3>Dovezi</h3><ul class="evidence">${evidence}</ul>
    <div class="sheet-actions">
      ${blocked ? button(ui, { action: 'fix-caps', label: 'Schimbă ce poți oferi', kind: 'cta', wide: true }) : `
      ${button(ui, { action: 'approve', label: 'Aprobă', kind: 'cta', iconName: 'check', wide: true })}
      ${button(ui, { action: 'preview', label: draft.previewing ? 'Ascunde de pe pagină' : 'Arată pe pagina mea', iconName: 'eye', wide: true })}`}
    </div>`;
}

const VIEWS = { product: productView, market: marketView, changes: changesView, experiments: experimentsView };

export function tabView(state, ui) {
  return VIEWS[ui.tab](state, ui);
}

export function primaryAction(state, ui) {
  if (ui.tab === 'product') {
    return state.analysis ? { action: 'open-report', label: 'Vezi raportul', icon: 'eye' }
      : { action: 'analyze', label: 'Analizează site-ul meu', icon: 'radar' };
  }
  if (ui.tab === 'market') {
    if (state.classified.length) return { action: 'track', label: 'Urmărește selecția', icon: 'check' };
    if (state.candidates.length) return { action: 'read-candidates', label: 'Citește paginile', icon: 'eye' };
    return state.own ? { action: 'discover', label: 'Urmărește piața', icon: 'radar' } : null;
  }
  if (ui.tab === 'changes' && state.rivals.length) return { action: 'check', label: 'Verifică acum', icon: 'refresh' };
  return null;
}

function tabButton(tab, ui, badges) {
  return `<button type="button" data-tab="${tab.id}" ${tab.id === ui.tab ? 'aria-current="page"' : ''}>
    ${icon(tab.icon)}<span>${tab.label}</span>
    ${badges[tab.id] ? `<span class="badge" aria-label="${badges[tab.id]} elemente">${badges[tab.id]}</span>` : ''}
  </button>`;
}

export function tabBarView(state, ui) {
  const changes = state.rivals.reduce((sum, rival) => sum + rival.pending.length + rival.confirmed.length, 0);
  const badges = { changes, experiments: state.approved.length };
  const primary = primaryAction(state, ui);
  const fab = primary
    ? `<button type="button" class="fab" data-action="${primary.action}" aria-label="${esc(primary.label)}" ${ui.busy ? 'disabled' : ''}>
        ${ui.busy === primary.action ? '<span class="spinner" aria-hidden="true"></span>' : icon(primary.icon)}</button>`
    : `<span class="fab idle" aria-hidden="true">${icon('spark')}</span>`;
  return `${TABS.slice(0, 2).map((tab) => tabButton(tab, ui, badges)).join('')}${fab}
    ${TABS.slice(2).map((tab) => tabButton(tab, ui, badges)).join('')}`;
}
