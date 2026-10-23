export function createTrashPages(context) {
  const { state, h, api, notify, guard, fmtDate, shell, route } = context;

// ---------- trash ----------
async function trashView() {
  const { products } = await api('/products/trash');
  const load = () => route();
  shell('Trash', null, h('div', { class: 'card' }, h('p', { class: 'help' }, 'Deleted products stay here for 30 days, then are removed for good. Restored products come back as drafts so you can check them before publishing.'),
    products.length ? h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Photo', 'Design', 'Deleted', 'Removed for good', ''].map((t) => h('th', {}, t)))), h('tbody', {}, products.map((p) =>
      h('tr', {}, h('td', {}, h('img', { class: 'thumb', src: p.images[0], alt: '' })), h('td', {}, h('strong', {}, p.name), h('br'), p.code), h('td', {}, fmtDate(p.deleted_at)),
        h('td', {}, new Date(p.purge_on).toLocaleDateString('en-IN', { dateStyle: 'medium' })),
        h('td', {}, h('button', { class: 'btn sm', type: 'button', onclick: guard(async () => { await api(`/products/${p.id}/restore`, { method: 'POST' }); state.flash = ['ok', `${p.name} restored as a draft.`]; location.hash = '#/products'; }) }, 'Restore'), ' ',
          state.user.role === 'owner' ? h('button', { class: 'btn sm danger', type: 'button', onclick: guard(async () => { if (!confirm(`Delete ${p.name} forever? This cannot be undone.`)) return; await api(`/products/${p.id}/forever`, { method: 'DELETE' }); load(); }) }, 'Delete forever') : null)))))) : h('p', {}, 'The Trash is empty.')));
}

  return { trashView };
}
