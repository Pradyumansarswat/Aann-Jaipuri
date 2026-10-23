export function createContentPages(context, mediaControls = {}) {
  const { state, h, api, notify, guard, fmtDate, shell, route } = context;
  const { uploadFiles, imageControl, photoGrid, altHelp } = mediaControls;

// ---------- website content (rendered from the server schema) ----------
function buildField(f, value) {
  const label = (child, help) => h('label', { class: 'f' }, f.label, child, (help || f.help) ? h('small', {}, help || f.help) : null);
  if (f.type === 'bool') { const c = h('input', { type: 'checkbox', checked: !!value }); return { el: h('label', { class: 'f' }, h('span', {}, c, ' ', f.label), f.help ? h('small', {}, f.help) : null), get: () => c.checked }; }
  if (f.type === 'textarea') { const t = h('textarea', { maxlength: f.max, value: value ?? '', rows: f.rows || 3 }); return { el: label(t), get: () => t.value }; }
  if (f.type === 'image') { const c = imageControl(value, () => {}); return { el: h('div', { class: 'f' }, h('span', {}, f.label), c.el), get: c.get }; }
  if (f.type === 'strings') {
    let items = [...(value || [])]; const box = h('div', { class: 'stack' });
    const draw = () => box.replaceChildren(...items.map((s, i) => h('div', { class: 'filters' }, h('input', { value: s, maxlength: f.itemMax, 'aria-label': `${f.label} ${i + 1}`, oninput: (e) => { items[i] = e.target.value; } }),
      h('button', { class: 'btn sm danger', type: 'button', onclick: () => { items.splice(i, 1); draw(); } }, 'Remove'))),
    items.length < f.max ? h('div', {}, h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { items.push(''); draw(); } }, '+ Add')) : null);
    draw();
    return { el: h('div', { class: 'f' }, h('span', {}, f.label), box), get: () => items.map((s) => s.trim()).filter(Boolean) };
  }
  if (f.type === 'list') {
    let rows = (value || []).map((v) => f.fields.map((sf) => buildField(sf, v[sf.key])));
    const box = h('div', { class: 'stack' });
    const draw = () => box.replaceChildren(...rows.map((cols, i) => h('div', { class: 'group' },
      h('div', { class: 'group-head' }, `${f.label.replace(/s$/, '')} ${i + 1}`, h('span', {},
        h('button', { class: 'btn sm ghost', type: 'button', disabled: i === 0, 'aria-label': 'Move up', onclick: () => { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; draw(); } }, '\u2191'), ' ',
        h('button', { class: 'btn sm ghost', type: 'button', disabled: i === rows.length - 1, 'aria-label': 'Move down', onclick: () => { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; draw(); } }, '\u2193'), ' ',
        h('button', { class: 'btn sm danger', type: 'button', onclick: () => { rows.splice(i, 1); draw(); } }, 'Remove'))),
      cols.map((c) => c.el))),
    rows.length < f.max ? h('div', {}, h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { rows.push(f.fields.map((sf) => buildField(sf, sf.type === 'strings' ? [] : sf.type === 'bool' ? false : ''))); draw(); } }, `+ Add ${f.label.toLowerCase().replace(/s$/, '')}`)) : null);
    draw();
    return { el: h('div', { class: 'f' }, h('h3', {}, f.label), box), get: () => rows.map((cols) => Object.fromEntries(cols.map((c, i) => [f.fields[i].key, c.get()]))) };
  }
  const type = { email: 'email', url: 'url', mapurl: 'url', digits: 'tel', 'digits-short': 'text' }[f.type] || 'text';
  const i = h('input', { type, value: value ?? '', maxlength: f.max || 1500, ...(f.type === 'digits' ? { inputmode: 'numeric', pattern: '[0-9]{10,15}' } : {}) });
  return { el: label(i), get: () => i.value };
}

async function contentView(section) {
  const { schema, content } = await api('/content');
  const sec = schema[section];
  if (!sec) { location.hash = '#/dashboard'; return; }
  const fields = sec.fields.map((f) => buildField(f, content[section][f.key]));
  const save = h('button', { class: 'btn', type: 'submit' }, 'Save changes');
  const form = h('form', { class: 'stack' }, h('div', { class: 'card stack' }, h('p', { class: 'help' }, sec.help), fields.map((x) => x.el)),
    h('div', {}, save, ' ', h('button', { class: 'btn danger', type: 'button', onclick: guard(async () => {
      if (!confirm('Reset this page to the original starter text? Your edits to it will be lost.')) return;
      await api(`/content/${section}`, { method: 'DELETE' }); route(); }) }, 'Reset to starter text')));
  form.addEventListener('submit', guard(async (e) => {
    e.preventDefault(); save.disabled = true;
    try { await api(`/content/${section}`, { method: 'PUT', body: Object.fromEntries(sec.fields.map((f, i) => [f.key, fields[i].get()])) }); notify('ok', 'Saved. The website is updated.'); }
    finally { save.disabled = false; }
  }));
  shell(sec.label, section === 'home' ? h('a', { class: 'btn ghost', href: '/', target: '_blank', rel: 'noopener' }, 'Preview home') : null, form);
}

  return { contentView };
}
