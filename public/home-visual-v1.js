/* GREENPARK_HOME_VISUAL_V1 */

const FIELD_IMAGE =
  'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=1600';

const ICON_SPECS = {
  LISTA: {
    color: '#63e93b',
    symbol: '✓'
  },
  RANKING: {
    color: '#f1c84b',
    symbol: '♛'
  },
  ESTATISTICAS: {
    color: '#5cc8ff',
    symbol: '▦'
  },
  TIMES: {
    color: '#b08cff',
    symbol: '▣'
  },
  GALERIA: {
    color: '#ff7cc5',
    symbol: '◫'
  },
  COMUNICADOS: {
    color: '#ff9c43',
    symbol: '✦'
  },
  PATROCINADORES: {
    color: '#4de1d4',
    symbol: '◆'
  },
  TORNEIOS: {
    color: '#ffd84f',
    symbol: '🏆'
  }
};

function normalizeText(value){
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function ensureStyle(){
  if (document.getElementById('greenpark-home-visual-v1-style')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'greenpark-home-visual-v1-style';
  style.textContent = `
/* GREENPARK_HOME_VISUAL_V1 */

.gphv1-home-background{
  position:relative!important;
  isolation:isolate!important;
  overflow:hidden!important;
}

.gphv1-home-background::before{
  content:"";
  position:absolute;
  inset:0;
  z-index:0;
  pointer-events:none;
  background:
    linear-gradient(
      180deg,
      rgba(3,10,18,.92) 0%,
      rgba(3,10,18,.76) 28%,
      rgba(3,18,12,.86) 100%
    ),
    url("${FIELD_IMAGE}") center center / cover no-repeat;
  opacity:.42;
}

.gphv1-home-background > *{
  position:relative;
  z-index:1;
}

.gphv1-quick-card{
  position:relative!important;
}

.gphv1-quick-card .gphv1-quick-icon{
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  width:22px!important;
  height:22px!important;
  margin:0 auto 7px auto!important;
  font-size:18px!important;
  font-weight:900!important;
  line-height:1!important;
  color:var(--gphv1-icon-color,#63e93b)!important;
  text-shadow:
    0 0 10px rgba(255,255,255,.08),
    0 0 18px color-mix(in srgb, var(--gphv1-icon-color,#63e93b) 70%, transparent)!important;
}

.gphv1-quick-card .gphv1-quick-icon svg{
  width:100%;
  height:100%;
}

.gphv1-quick-card [data-gphv1-existing-icon="1"]{
  color:var(--gphv1-icon-color,#63e93b)!important;
  filter:drop-shadow(0 0 10px rgba(0,0,0,.12));
}

.gphv1-quick-card[data-gphv1-label="TORNEIOS"] .gphv1-quick-icon{
  font-size:17px!important;
}

@media (max-width: 420px){
  .gphv1-quick-card .gphv1-quick-icon{
    width:20px!important;
    height:20px!important;
    margin:0 auto 6px auto!important;
    font-size:16px!important;
  }
}
`;
  document.head.appendChild(style);
}

function findHomeRoot(){
  const byId =
    document.getElementById('homeView') ||
    document.getElementById('inicioView') ||
    document.getElementById('startView');

  if (byId) {
    return byId;
  }

  const candidates = Array.from(document.querySelectorAll('section, main, div'))
    .filter((el) => {
      const text = normalizeText(el.textContent);
      return (
        text.includes('PROXIMO RACHA') &&
        text.includes('ENTRAR NO RACHA') &&
        text.includes('ACESSOS RAPIDOS')
      );
    })
    .sort((a, b) => (b.textContent.length - a.textContent.length));

  return candidates[0] || null;
}

function findQuickAccessScope(){
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,div,strong,span,p'))
    .filter((el) => normalizeText(el.textContent) === 'ACESSOS RAPIDOS');

  for (const heading of headings) {
    let scope = heading.closest('section,div');
    while (scope && scope.querySelectorAll('button,a,[role="button"],[onclick]').length < 6) {
      scope = scope.parentElement?.closest?.('section,div') || scope.parentElement;
    }
    if (scope) {
      return scope;
    }
  }

  return findHomeRoot();
}

function findSpecByText(text){
  const normalized = normalizeText(text);

  if (normalized.includes('ESTATISTICA')) return ['ESTATISTICAS', ICON_SPECS.ESTATISTICAS];
  if (normalized.includes('PATROCINADOR')) return ['PATROCINADORES', ICON_SPECS.PATROCINADORES];
  if (normalized.includes('COMUNICADO')) return ['COMUNICADOS', ICON_SPECS.COMUNICADOS];
  if (normalized.includes('TORNEIO')) return ['TORNEIOS', ICON_SPECS.TORNEIOS];
  if (normalized.includes('RANKING')) return ['RANKING', ICON_SPECS.RANKING];
  if (normalized.includes('GALERIA')) return ['GALERIA', ICON_SPECS.GALERIA];
  if (normalized.includes('TIMES')) return ['TIMES', ICON_SPECS.TIMES];
  if (normalized.includes('LISTA')) return ['LISTA', ICON_SPECS.LISTA];

  return null;
}

function looksLikeIconElement(el){
  if (!el || !(el instanceof HTMLElement)) {
    return false;
  }

  const classText =
    (el.className && typeof el.className === 'string')
      ? el.className.toLowerCase()
      : '';

  const shortText =
    normalizeText(el.textContent).length <= 3 &&
    normalizeText(el.textContent).length > 0;

  return (
    el.tagName === 'SVG' ||
    el.tagName === 'I' ||
    classText.includes('icon') ||
    classText.includes('glyph') ||
    classText.includes('symbol') ||
    shortText
  );
}

function findExistingIcon(card){
  const directChildren = Array.from(card.children || []);
  for (const child of directChildren) {
    if (looksLikeIconElement(child)) {
      return child;
    }
    const nested =
      child.querySelector?.('svg, i, [class*="icon"], [class*="Icon"]');
    if (nested) {
      return nested;
    }
  }
  return null;
}

function ensureFallbackIcon(card, spec){
  let icon = card.querySelector('.gphv1-quick-icon');

  if (!icon) {
    icon = document.createElement('span');
    icon.className = 'gphv1-quick-icon';
    icon.textContent = spec.symbol;

    if (card.firstElementChild) {
      card.insertBefore(icon, card.firstElementChild);
    } else {
      card.appendChild(icon);
    }
  }

  return icon;
}

function decorateQuickCard(card){
  const found = findSpecByText(card.textContent);
  if (!found) return;

  const [label, spec] = found;

  card.classList.add('gphv1-quick-card');
  card.dataset.gphv1Label = label;
  card.style.setProperty('--gphv1-icon-color', spec.color);

  const existingIcon = findExistingIcon(card);

  if (existingIcon) {
    existingIcon.setAttribute('data-gphv1-existing-icon', '1');
    existingIcon.style.color = spec.color;
    existingIcon.style.fill = spec.color;
    existingIcon.style.stroke = spec.color;
  } else {
    const fallback = ensureFallbackIcon(card, spec);
    fallback.textContent = spec.symbol;
    fallback.style.color = spec.color;
  }
}

function decorateQuickAccess(){
  const scope = findQuickAccessScope();
  if (!scope) return;

  const cards = Array.from(
    scope.querySelectorAll('button,a,[role="button"],[onclick]')
  ).filter((el) => !!findSpecByText(el.textContent));

  cards.forEach(decorateQuickCard);
}

function applyHomeBackground(){
  const homeRoot = findHomeRoot();
  if (!homeRoot) return;

  homeRoot.classList.add('gphv1-home-background');
}

function run(){
  ensureStyle();
  applyHomeBackground();
  decorateQuickAccess();
}

function boot(){
  run();

  const observer = new MutationObserver(() => {
    run();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener('pageshow', run);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      run();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
