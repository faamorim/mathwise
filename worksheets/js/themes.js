/*
 * Themes: how a worksheet looks, kept apart from what it says.
 *
 * A document may carry `theme`: { name, ...overrides }. `name` picks a built-in
 * theme below; any other key overrides one setting of it. No `theme` = Classic,
 * which is exactly the original look. A theme can also be saved to its own .json
 * file and loaded into other documents (the same object without the content).
 *
 * The renderer only calls apply(pagesElement, doc.theme): every setting becomes a
 * CSS variable (or a class) on the pages, and sheet.css reads those variables.
 */
(function (WS) {
  'use strict';

  var FONTS = {
    sans: { label: 'Sans (Segoe UI / Calibri / Arial)', css: '"Segoe UI", Calibri, Arial, Helvetica, sans-serif' },
    serif: { label: 'Serif (Cambria / Georgia)', css: 'Cambria, Georgia, "Times New Roman", serif' },
    rounded: { label: 'Rounded (Nunito / Arial Rounded)', css: 'Nunito, "Varela Round", "Arial Rounded MT Bold", "Segoe UI", Arial, sans-serif' },
    friendly: { label: 'Friendly (Comic Neue / Trebuchet)', css: '"Comic Neue", "Trebuchet MS", "Segoe UI", Arial, sans-serif' },
    mono: { label: 'Typewriter (Consolas / Courier)', css: 'Consolas, "Courier New", monospace' }
  };

  // Every setting, with the Classic value. Keep this list and sheet.css in step.
  var SETTINGS = [
    { key: 'font', label: 'Font', type: 'choice', values: Object.keys(FONTS).map(function (k) { return [k, FONTS[k].label]; }) },
    { key: 'fontSize', label: 'Text size (pt)', type: 'number', min: 9, max: 16, step: 0.5 },
    { key: 'ink', label: 'Text colour', type: 'color' },
    { key: 'accent', label: 'Titles & labels colour', type: 'color' },
    { key: 'rule', label: 'Lines & boxes colour', type: 'color' },
    { key: 'lineWidth', label: 'Line thickness (px)', type: 'number', min: 0.5, max: 3, step: 0.5 },
    { key: 'boxes', label: 'Part boxes', type: 'choice', values: [['grid', 'Joined grid'], ['cards', 'Separate cards']] },
    { key: 'corners', label: 'Rounded corners (pt)', type: 'number', min: 0, max: 16, step: 1 },
    { key: 'shade', label: 'Box fill', type: 'color', optional: true }
  ];

  var CLASSIC = { font: 'sans', fontSize: 12, ink: '#111111', accent: '#111111', rule: '#222222',
    lineWidth: 1, boxes: 'grid', corners: 0, shade: '' };

  var THEMES = {
    classic: { label: 'Classic', settings: {} },
    rounded: { label: 'Rounded cards', settings: { font: 'rounded', boxes: 'cards', corners: 8, rule: '#5b6b84', accent: '#24406e' } },
    soft: { label: 'Soft colour', settings: { font: 'sans', boxes: 'cards', corners: 12, rule: '#9fb3d1', shade: '#f5f8fd', accent: '#2a5aa8', lineWidth: 1.5 } },
    serif: { label: 'Serif print', settings: { font: 'serif', fontSize: 12, accent: '#000000' } },
    bold: { label: 'Bold lines', settings: { lineWidth: 2, rule: '#000000', corners: 4, boxes: 'cards' } }
  };

  // The full settings for a stored theme (built-in values + its overrides).
  function resolve(theme) {
    theme = theme || {};
    var base = THEMES[theme.name] || THEMES.classic;
    var out = {};
    Object.keys(CLASSIC).forEach(function (k) { out[k] = CLASSIC[k]; });
    Object.keys(base.settings).forEach(function (k) { out[k] = base.settings[k]; });
    Object.keys(theme).forEach(function (k) { if (k !== 'name' && k in CLASSIC && theme[k] != null) out[k] = theme[k]; });
    return out;
  }

  function apply(el, theme) {
    var s = resolve(theme);
    var st = el.style;
    st.setProperty('--font', (FONTS[s.font] || FONTS.sans).css);
    st.setProperty('--font-size', (+s.fontSize || 12) + 'pt');
    st.setProperty('--ink', s.ink);
    st.setProperty('--accent', s.accent);
    st.setProperty('--rule', s.rule);
    st.setProperty('--lw', (+s.lineWidth || 1) + 'px');
    st.setProperty('--radius', (+s.corners || 0) + 'pt');
    st.setProperty('--shade', s.shade || 'transparent');
    el.classList.toggle('boxes-cards', s.boxes === 'cards');
    el.classList.toggle('rounded', +s.corners > 0);
  }

  // A theme saved as its own file: { mathwiseTheme: 1, name, ...settings }.
  function toFile(theme) {
    var out = { mathwiseTheme: 1, name: (theme && theme.name) || 'classic' };
    var s = resolve(theme);
    Object.keys(s).forEach(function (k) { out[k] = s[k]; });
    return out;
  }
  function fromFile(obj) {
    if (!obj || typeof obj !== 'object' || !obj.mathwiseTheme) throw new Error('This is not a Mathwise theme file.');
    var t = { name: THEMES[obj.name] ? obj.name : 'classic' };
    var base = resolve({ name: t.name });
    Object.keys(CLASSIC).forEach(function (k) { if (obj[k] != null && obj[k] !== base[k]) t[k] = obj[k]; });
    return t;
  }

  WS.themes = { FONTS: FONTS, SETTINGS: SETTINGS, THEMES: THEMES, CLASSIC: CLASSIC,
    resolve: resolve, apply: apply, toFile: toFile, fromFile: fromFile };
})(window.WS = window.WS || {});
