export function createCataloguePages(context) {
  const { state, h, api, notify, guard, fmtDate, shell, route } = context;

  // ---------- catalogue PDF ----------
  async function catalogueView() {
    const st = await api('/catalogue');
    const input = h('input', { type: 'file', accept: 'application/pdf', hidden: true, onchange: guard(async (e) => { const fd = new FormData(); fd.append('file', e.target.files[0]); await api('/catalogue/upload', { method: 'POST', form: fd }); state.flash = ['ok', 'Your PDF is now the catalogue visitors receive.']; route(); }) });
    const date = (iso) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    shell('Catalogue PDF', h('a', { class: 'btn ghost', href: '/catalogue', target: '_blank', rel: 'noopener' }, 'View public page'),
      h('div', { class: 'card stack' }, h('h2', {}, 'What visitors receive'),
        st.custom ? h('p', {}, h('strong', {}, 'Your uploaded PDF'), ` (${(st.custom.size / 1048576).toFixed(1)} MB, uploaded ${date(st.custom.at)}). The automatic catalogue is paused while this is in place.`)
          : h('p', {}, h('strong', {}, 'The automatic catalogue'), ` built from your ${st.products} published designs.`,
            st.auto ? ` Last built ${date(st.auto.at)}${st.stale ? '. Your products have changed since, so it rebuilds the next time someone downloads it.' : '. It is up to date.'}` : ' It builds the first time someone downloads it.'),
        h('div', { class: 'acts' }, h('a', { class: 'btn', href: '/api/admin/catalogue/file' }, 'Download current PDF'),
          st.custom ? null : h('button', { class: 'btn ghost', type: 'button', onclick: guard(async (ev) => { ev.target.disabled = true; ev.target.textContent = 'Building...'; await api('/catalogue/rebuild', { method: 'POST' }); state.flash = ['ok', 'Catalogue rebuilt.']; route(); }) }, 'Rebuild now'))),
      h('div', { class: 'card stack' }, h('h2', {}, 'Use your own designed PDF'), h('p', { class: 'help' }, 'If a designer made a lookbook, upload it here (PDF, up to 25 MB). Visitors get your file instead of the automatic one.'),
        h('div', { class: 'acts' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => input.click() }, st.custom ? 'Replace PDF' : 'Upload PDF'), input,
          st.custom ? h('button', { class: 'btn danger', type: 'button', onclick: guard(async () => { if (!confirm('Go back to the automatic catalogue?')) return; await api('/catalogue/custom', { method: 'DELETE' }); route(); }) }, 'Remove my PDF') : null)),
      h('div', { class: 'card' }, h('h2', {}, 'Page text and download rules'), h('p', { class: 'help' }, 'Change the headings, the PDF cover text, and whether visitors must fill in their shop details first.'),
        h('a', { class: 'btn ghost', href: '#/content/catalogue' }, 'Edit catalogue text')));
  }

  return { catalogueView };
}
