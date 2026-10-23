export function createCategoryPages(context, mediaControls = {}) {
  const { state, h, api, notify, guard, fmtDate, shell, route } = context;
  const { uploadFiles, imageControl, photoGrid, altHelp } = mediaControls;

// ---------- categories ----------
async function categoriesView() {
  const { categories } = await api('/categories');
  const body = h('tbody', {}, categories.map((c) => h('tr', {}, h('td', {}, h('img', { class: 'thumb', src: c.image || '/assets/placeholder.svg', alt: '' })),
    h('td', {}, h('strong', {}, c.name), h('br'), c.tagline), h('td', {}, c.product_count),
    h('td', {}, h('span', { class: `tag ${c.active ? 'pub' : 'draft'}` }, c.active ? 'Visible' : 'Hidden'), c.on_home ? h('span', { class: 'tag' }, 'On home') : null),
    h('td', {}, h('button', { class: 'btn sm ghost', type: 'button', onclick: () => categoryDialog(c) }, 'Edit'), ' ',
      h('button', { class: 'btn sm danger', type: 'button', onclick: guard(async () => { if (!confirm(`Delete ${c.name}? Products stay, but lose this category.`)) return; await api(`/categories/${c.id}`, { method: 'DELETE' }); route(); }) }, 'Delete')))));
  shell('Categories', h('button', { class: 'btn', type: 'button', onclick: () => categoryDialog() }, '+ Add category'),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Image', 'Category', 'Designs', 'Shown', ''].map((t) => h('th', {}, t)))), body)));
}
function categoryDialog(c = { name: '', tagline: '', description: '', moq: '', image: '', sort: 100, active: 1, on_home: 1 }) {
  const el = (name, label, extra = {}) => h('label', { class: 'f' }, label, h('input', { name, value: c[name] ?? '', ...extra }));
  const name = el('name', 'Name *', { required: true, maxlength: 60 }), tagline = el('tagline', 'Short tagline', { maxlength: 120 }), moq = el('moq', 'Minimum order', { maxlength: 100 }), sort = el('sort', 'Display order', { type: 'number', min: 0, max: 9999 });
  const description = h('textarea', { maxlength: 400, value: c.description });
  const active = h('input', { type: 'checkbox', checked: !!c.active }), onHome = h('input', { type: 'checkbox', checked: !!c.on_home });
  const image = imageControl(c.image, () => {});
  const err = h('p', { class: 'msg err', hidden: true, role: 'alert' });
  const dlg = h('dialog', { 'aria-label': 'Category' });
  const form = h('form', { class: 'db stack' }, err, h('div', { class: 'grid' }, name, tagline, moq, sort), h('label', { class: 'f' }, 'Description', description),
    h('div', {}, h('p', { class: 'help' }, 'Category image'), image.el), h('div', { class: 'checks' }, h('label', {}, active, 'Visible on website'), h('label', {}, onHome, 'Show on home page')),
    h('div', {}, h('button', { class: 'btn', type: 'submit' }, 'Save category'), ' ', h('button', { class: 'btn ghost', type: 'button', onclick: () => { dlg.close(); dlg.remove(); } }, 'Cancel')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = (n) => n.querySelector('input').value;
    try {
      await api(c.id ? `/categories/${c.id}` : '/categories', { method: c.id ? 'PUT' : 'POST', body: { name: v(name), tagline: v(tagline), moq: v(moq), sort: Number(v(sort) || 100),
        description: description.value, image: image.get(), active: active.checked, on_home: onHome.checked } });
      dlg.close(); dlg.remove(); route();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  dlg.append(h('div', { class: 'dh' }, h('h2', {}, c.id ? 'Edit category' : 'New category')), form);
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}

  return { categoriesView };
}
