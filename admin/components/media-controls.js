export function createMediaControls(context) {
  const { h, api, notify, guard } = context;

// ---------- image picker ----------
function pickImage() {
  return new Promise((resolve) => {
    const grid = h('div', { class: 'lib' });
    const status = h('p', { class: 'help' }, 'Loading...');
    const dlg = h('dialog', { 'aria-label': 'Choose an image' });
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true });
    file.addEventListener('change', async () => {
      if (!file.files.length) return;
      status.textContent = 'Uploading...';
      try { await uploadFiles(file.files); await load(); } catch (e) { status.textContent = e.message; }
    });
    async function load() {
      const { files } = await api('/media');
      status.textContent = files.length ? 'Click an image to use it.' : 'No images yet. Upload your first photo.';
      grid.replaceChildren(...files.map((f) => h('button', { type: 'button', onclick: () => done(f.url) }, h('img', { src: f.thumb, alt: f.name || '', loading: 'lazy' }), h('small', {}, f.used ? 'In use' : 'Unused'))));
    }
    dlg.append(h('div', { class: 'dh' }, h('h2', {}, 'Image library'), h('div', {}, h('button', { class: 'btn sm', type: 'button', onclick: () => file.click() }, 'Upload new'), ' ',
      h('button', { class: 'btn sm ghost', type: 'button', onclick: () => done(null) }, 'Close'))), h('div', { class: 'db' }, status, grid, file));
    dlg.addEventListener('cancel', () => { dlg.remove(); resolve(null); });
    document.body.append(dlg); dlg.showModal(); load().catch((e) => { status.textContent = e.message; });
  });
}
async function uploadFiles(fileList) {
  const fd = new FormData();
  [...fileList].forEach((f) => fd.append('files', f));
  const r = await api('/upload', { method: 'POST', form: fd });
  if (r.errors?.length) notify('err', r.errors.join(' '));
  return r.files;
}

function imageControl(value, onChange) {
  let v = value || '';
  const wrap = h('div', { class: 'imgs' });
  const draw = () => {
    wrap.replaceChildren(
      v ? h('div', { class: 'img' }, h('img', { src: v, alt: '' }), h('div', {}, h('span', {}), h('button', { type: 'button', 'aria-label': 'Remove image', onclick: () => { v = ''; onChange(v); draw(); } }, '\u00d7'))) : null,
      h('button', { class: 'addimg', type: 'button', onclick: async () => { const p = await pickImage(); if (p) { v = p; onChange(v); draw(); } } }, v ? 'Change' : '+ Choose'));
  };
  draw();
  return { el: wrap, get: () => v };
}

const altHelp = 'Alt text describes the photo for Google Images and for visitors who use screen readers. Example: "Maroon block print Anarkali kurti, front view". Leave blank to use the product name.';
function photoGrid(photos, onChange) {
  const box = h('div', { class: 'imgs' });
  const draw = () => {
    box.replaceChildren(...photos.map((ph, i) => h('div', { class: `img alt${i === 0 ? ' first' : ''}` }, h('img', { src: ph.url, alt: ph.alt || '' }),
      h('input', { value: ph.alt, maxlength: 160, placeholder: 'Describe this photo', 'aria-label': `Alt text for photo ${i + 1}`, oninput: (e) => { ph.alt = e.target.value; } }),
      h('div', {}, h('button', { type: 'button', 'aria-label': 'Move earlier', disabled: i === 0, onclick: () => { [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]]; draw(); } }, '\u2190'),
        h('span', { class: 'help' }, i === 0 ? 'Main' : ''),
        h('button', { type: 'button', 'aria-label': 'Move later', disabled: i === photos.length - 1, onclick: () => { [photos[i + 1], photos[i]] = [photos[i], photos[i + 1]]; draw(); } }, '\u2192'),
        h('button', { type: 'button', 'aria-label': 'Remove photo', onclick: () => { photos.splice(i, 1); draw(); } }, '\u00d7')))),
    photos.length < 8 ? h('button', { class: 'addimg', type: 'button', onclick: guard(async () => { const u = await pickImage(); if (u && !photos.some((x) => x.url === u)) { photos.push({ url: u, alt: '' }); draw(); } }) }, '+ Add photo') : null);
    if (onChange) onChange();
  };
  draw();
  return { el: box, redraw: draw };
}

  return { uploadFiles, imageControl, photoGrid, altHelp };
}
