export function createMediaPages(context, mediaControls = {}) {
  const { state, h, api, notify, guard, fmtDate, shell, route } = context;
  const { uploadFiles, imageControl, photoGrid, altHelp } = mediaControls;

// ---------- images ----------
async function mediaView() {
  const { files } = await api('/media');
  const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true,
    onchange: guard(async (e) => { await uploadFiles(e.target.files); route(); }) });
  shell('Images', [h('button', { class: 'btn', type: 'button', onclick: () => input.click() }, '+ Upload images'), input],
    h('div', { class: 'card' }, files.length ? h('div', { class: 'lib' }, files.map((f) => h('div', {}, h('img', { src: f.thumb, alt: f.name || '', loading: 'lazy' }),
      h('small', {}, f.used ? 'In use' : 'Unused'), f.used ? null : h('button', { class: 'btn sm danger', type: 'button', onclick: guard(async () => { if (!confirm('Delete this image?')) return; await api(`/media/${f.id}`, { method: 'DELETE' }); route(); }) }, 'Delete'))))
      : h('p', { class: 'help' }, 'No uploaded images yet.')));
}

  return { mediaView };
}
