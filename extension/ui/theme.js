// Appearance preference. The app starts in Light. Dark is a choice made in Settings.

export const THEME_KEY = 'distinctAppearance';
export const DEFAULT_APPEARANCE = 'light';
export const APPEARANCES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

export function resolveTheme(preference, systemIsDark) {
  if (preference === 'dark') return 'dark';
  if (preference === 'system') return systemIsDark ? 'dark' : 'light';
  return 'light';
}

function apply(preference) {
  const systemIsDark = matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = resolveTheme(preference, systemIsDark);
}

// Runs before the first render, so a Dark user never sees a white flash.
export async function initTheme() {
  let preference = DEFAULT_APPEARANCE;
  try {
    const stored = await chrome.storage.local.get(THEME_KEY);
    preference = stored[THEME_KEY] ?? DEFAULT_APPEARANCE;
  } catch {
    // Storage can fail. The default theme still shows the page.
  }
  apply(preference);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(preference));
  chrome.storage.onChanged.addListener((changes) => {
    if (!changes[THEME_KEY]) return;
    preference = changes[THEME_KEY].newValue ?? DEFAULT_APPEARANCE;
    apply(preference);
  });
  return preference;
}

export function saveAppearance(preference) {
  return chrome.storage.local.set({ [THEME_KEY]: preference });
}
