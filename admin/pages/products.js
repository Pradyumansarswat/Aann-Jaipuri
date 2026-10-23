export function createProductPages(context, mediaControls = {}) {
  const { state, h, api, notify, guard, fmtDate, shell, route } = context;
  const { uploadFiles, imageControl, photoGrid, altHelp } = mediaControls;

// ---------- products ----------
async function productsList() {
  const q = h('input', { type: 'search', placeholder: 'Search name or code', 'aria-label': 'Search' });
  const st = h('select', { 'aria-label': 'Status' }, h('option', { value: '' }, 'All statuses'), h('option', { value: 'published' }, 'Published'), h('option', { value: 'draft' }, 'Drafts'));
  const body = h('tbody');
  const table = h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Photo', 'Design', 'Categories', 'Status', 'Flags', ''].map((t) => h('th', {}, t)))), body));
  shell('Products', h('a', { class: 'btn', href: '#/products/new' }, '+ Add product'), h('div', { class: 'filters' }, q, st), table);
  const load = guard(async () => {
    const { products } = await api(`/products?q=${encodeURIComponent(q.value)}&status=${st.value}`);
    body.replaceChildren(...(products.length ? products.map(productRow) : [h('tr', {}, h('td', { colspan: 6 }, 'No products found. Add your first design.'))]));
  });
  function productRow(p) {
    const toggle = (field) => guard(async () => { await api(`/products/${p.id}`, { method: 'PATCH', body: { [field]: !p[field] } }); load(); });
    return h('tr', {}, h('td', {}, h('img', { class: 'thumb', src: p.images[0], alt: '' })),
      h('td', {}, h('a', { href: `#/products/${p.id}` }, h('strong', {}, p.name)), h('br'), p.code),
      h('td', {}, p.categories.map((c) => h('span', { class: 'tag' }, c.name))),
      h('td', {}, h('span', { class: `tag ${p.status === 'published' ? 'pub' : 'draft'}` }, p.status)),
      h('td', {}, h('label', {}, h('input', { type: 'checkbox', checked: p.is_new, onchange: toggle('is_new') }), ' New'), h('br'),
        h('label', {}, h('input', { type: 'checkbox', checked: p.is_featured, onchange: toggle('is_featured') }), ' Featured')),
      h('td', {}, h('a', { class: 'btn sm ghost', href: `#/products/${p.id}` }, 'Edit'), ' ',
        p.status === 'published' ? h('a', { class: 'btn sm ghost', href: `/products/${p.slug}`, target: '_blank', rel: 'noopener' }, 'View') : null, ' ',
        h('button', { class: 'btn sm danger', type: 'button', onclick: guard(async () => { if (!confirm(`Move ${p.name} to the Trash? You can restore it for 30 days.`)) return; await api(`/products/${p.id}`, { method: 'DELETE' }); load(); }) }, 'Move to Trash')));
  }
  let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 250); }); st.addEventListener('change', load);
  load();
}

async function productEditor(idParam) {
  const isNew = idParam === 'new';
  const [{ categories }, existing] = await Promise.all([api('/categories'), isNew ? null : api(`/products/${idParam}`)]);
  const p = existing ? existing.product : { code: '', name: '', description: '', fabric: '', sizes: '', colors: '', moq: '', photos: [], categories: [], is_new: false, is_featured: false, status: 'published', sort: 100 };
  const photos = p.photos.map((x) => ({ ...x }));
  const inp = (name, label, extra = {}, help) => h('label', { class: 'f' }, label, h('input', { name, value: p[name] ?? '', ...extra }), help ? h('small', {}, help) : null);
  const f = {
    code: inp('code', 'Design code *', { required: true, maxlength: 30 }, 'Letters, numbers and dashes. Example: AANN-140'),
    name: inp('name', 'Product name *', { required: true, maxlength: 120 }),
    fabric: inp('fabric', 'Fabric', { maxlength: 160 }), sizes: inp('sizes', 'Sizes', { maxlength: 160 }, 'Example: M (38), L (40), XL (42), XXL (44)'),
    colors: inp('colors', 'Colours', { maxlength: 160 }), moq: inp('moq', 'Minimum order (MOQ)', { maxlength: 160 }, 'Example: 1 set (4 pieces)'),
    sort: inp('sort', 'Display order', { type: 'number', min: 0, max: 9999 }, 'Smaller numbers appear first.'),
  };
  const desc = h('textarea', { maxlength: 2000, value: p.description });
  const status = h('select', {}, h('option', { value: 'published', selected: p.status === 'published' }, 'Published (visible on website)'), h('option', { value: 'draft', selected: p.status === 'draft' }, 'Draft (hidden)'));
  const isNewCb = h('input', { type: 'checkbox', checked: p.is_new }), featCb = h('input', { type: 'checkbox', checked: p.is_featured });
  const catChecks = categories.map((c) => h('label', {}, h('input', { type: 'checkbox', value: c.id, checked: p.categories.includes(c.id) }), c.name));
  const grid = photoGrid(photos);
  const save = h('button', { class: 'btn', type: 'submit' }, isNew ? 'Add product' : 'Save changes');
  const form = h('form', { class: 'stack' },
    h('div', { class: 'card stack' }, h('h2', {}, 'Details'), h('div', { class: 'grid' }, f.name, f.code), h('label', { class: 'f' }, 'Description', desc),
      h('div', { class: 'grid' }, f.fabric, f.sizes, f.colors, f.moq)),
    h('div', { class: 'card stack' }, h('h2', {}, 'Photos'), h('p', { class: 'help' }, 'The first photo is the main one. The second shows when a visitor hovers over the product. JPG, PNG or WebP up to 8 MB each. ', altHelp),
      grid.el, h('div', {}, h('label', { class: 'btn sm ghost' }, 'Upload photos', h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true,
        onchange: guard(async (e) => { const up = await uploadFiles(e.target.files); up.forEach((u) => photos.length < 8 && photos.push({ url: u.url, alt: '' })); e.target.value = ''; grid.redraw(); }) })))),
    h('div', { class: 'card stack' }, h('h2', {}, 'Where it appears'), h('div', { class: 'checks' }, catChecks.length ? catChecks : h('p', { class: 'help' }, 'Create categories first.')),
      h('div', { class: 'grid' }, h('label', { class: 'f' }, 'Visibility', status), f.sort),
      h('div', { class: 'checks' }, h('label', {}, isNewCb, 'Mark as New arrival'), h('label', {}, featCb, 'Featured on home page'))),
    h('div', {}, save, ' ', h('a', { class: 'btn ghost', href: '#/products' }, 'Cancel'), ' ',
      isNew ? null : h('button', { class: 'btn danger', type: 'button', onclick: guard(async () => { if (!confirm('Move this product to the Trash? You can restore it for 30 days.')) return; await api(`/products/${idParam}`, { method: 'DELETE' }); state.flash = ['ok', 'Moved to Trash. You can restore it from the Trash page.']; location.hash = '#/products'; }) }, 'Move to Trash')));
  form.addEventListener('submit', guard(async (e) => {
    e.preventDefault(); save.disabled = true;
    const v = (n) => f[n].querySelector('input').value;
    const body = { code: v('code'), name: v('name'), description: desc.value, fabric: v('fabric'), sizes: v('sizes'), colors: v('colors'), moq: v('moq'),
      sort: Number(v('sort') || 100), photos: photos.map((x) => ({ url: x.url, alt: x.alt })),
      categories: catChecks.map((l) => l.firstChild).filter((c) => c.checked).map((c) => Number(c.value)),
      is_new: isNewCb.checked, is_featured: featCb.checked, status: status.value };
    try { await api(isNew ? '/products' : `/products/${idParam}`, { method: isNew ? 'POST' : 'PUT', body }); location.hash = '#/products'; }
    finally { save.disabled = false; }
  }));
  shell(isNew ? 'Add product' : `Edit ${p.name}`, null, form);
}

// ---------- bulk add ----------
async function bulkView() {
  const { categories } = await api('/categories');
  const rows = [];
  const field = (label, value, extra = {}) => h('label', { class: 'f' }, label, h('input', { value, ...extra }));
  const prefix = field('Code prefix', 'AANN-', { maxlength: 12 }), namePat = field('Default product name', 'Jaipuri Kurti', { maxlength: 100 });
  const fabric = field('Fabric', '', { maxlength: 160 }), sizes = field('Sizes', 'M (38), L (40), XL (42), XXL (44)', { maxlength: 160 });
  const colors = field('Colours', '', { maxlength: 160 }), moq = field('Minimum order (MOQ)', '1 Set (4 Pieces)', { maxlength: 160 });
  const status = h('select', {}, h('option', { value: 'draft' }, 'Draft (review first, then publish)'), h('option', { value: 'published' }, 'Published immediately'));
  const isNewCb = h('input', { type: 'checkbox', checked: true });
  const catChecks = categories.map((c) => h('label', {}, h('input', { type: 'checkbox', value: c.id }), c.name));
  const val = (x) => x.querySelector('input').value;
  const status1 = h('p', { class: 'help', role: 'status' }, 'No photos added yet.');
  const body = h('tbody');
  const table = h('div', { class: 'scroll', hidden: true }, h('table', {}, h('thead', {}, h('tr', {}, ['Photo', 'Name', 'Code', 'Alt text', ''].map((t) => h('th', {}, t)))), body));
  const createBtn = h('button', { class: 'btn', type: 'button', disabled: true }, 'Create products');
  let importedRows = [];
  const importStatus = h('p', { class: 'help', role: 'status' }, 'Select an .xlsx or .csv file exported from Excel.');
  const importBody = h('tbody');
  const importTable = h('div', { class: 'scroll', hidden: true }, h('table', {},
    h('thead', {}, h('tr', {}, ['Code', 'Name', 'Description', 'Fabric', 'Sizes', 'Colours', 'MOQ', 'Categories', ''].map((t) => h('th', {}, t)))),
    importBody));
  const importButton = h('button', { class: 'btn', type: 'button', disabled: true }, 'Create products as drafts');
  const importFile = h('input', { type: 'file', accept: '.xlsx,.csv', hidden: true });
  const importFields = ['code', 'name', 'description', 'fabric', 'sizes', 'colors', 'moq', 'categories'];
  function drawImportedRows() {
    importTable.hidden = !importedRows.length;
    importButton.disabled = !importedRows.length;
    importButton.textContent = `Create ${importedRows.length} product${importedRows.length === 1 ? '' : 's'} as drafts`;
    importBody.replaceChildren(...importedRows.map((row, index) => h('tr', {},
      ...importFields.map((key) => h('td', {}, h('input', {
        value: row[key] || '',
        maxlength: key === 'description' ? 2000 : key === 'name' ? 120 : key === 'code' ? 30 : 300,
        'aria-label': `${key} for spreadsheet row ${row.row}`,
        oninput: (event) => { row[key] = event.target.value; },
      }))),
      h('td', {}, h('button', { class: 'btn sm danger', type: 'button', onclick: () => {
        importedRows.splice(index, 1); drawImportedRows();
      } }, 'Remove')))));
  }
  const templateLink = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => {
    const csv = 'code,name,description,fabric,sizes,colors,moq,categories\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = h('a', { href: url, download: 'product-import-template.csv' });
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } }, 'Download spreadsheet template');
  importFile.addEventListener('change', guard(async () => {
    const file = importFile.files[0];
    if (!file) return;
    importButton.disabled = true; importStatus.textContent = 'Reading spreadsheet...';
    const form = new FormData(); form.append('file', file);
    try {
      const result = await api('/products/import/preview', { method: 'POST', form });
      importedRows = result.items;
      drawImportedRows();
      importStatus.textContent = `${importedRows.length} product${importedRows.length === 1 ? '' : 's'} ready to review. Images are skipped; add them later in each product editor.`;
    } catch (error) {
      importStatus.textContent = error.message;
      importButton.disabled = !importedRows.length;
      throw error;
    } finally {
      importFile.value = '';
    }
  }));
  importButton.addEventListener('click', guard(async () => {
    importButton.disabled = true;
    try {
      const items = importedRows.map((row, index) => {
        const categoryNames = row.categories.split(',').map((name) => name.trim()).filter(Boolean);
        const matchedCategories = categoryNames.map((name) => categories.find((category) => category.name.toLowerCase() === name.toLowerCase()));
        const missing = categoryNames.filter((name, i) => !matchedCategories[i]);
        if (missing.length) throw new Error(`Spreadsheet row ${row.row}: unknown category ${missing.join(', ')}.`);
        return {
          code: row.code, name: row.name, description: row.description, fabric: row.fabric, sizes: row.sizes,
          colors: row.colors, moq: row.moq, photos: [], categories: matchedCategories.map((category) => category.id),
          is_new: false, is_featured: false, status: 'draft', sort: 100 + index,
        };
      });
      const result = await api('/products/bulk', { method: 'POST', body: { items } });
      state.flash = ['ok', `${result.created} products imported as drafts. Add photos and publish them from the product editor.`];
      location.hash = '#/products';
    } catch (error) {
      importButton.disabled = false;
      throw error;
    }
  }));
  const drawRows = () => {
    table.hidden = !rows.length; createBtn.disabled = !rows.length; createBtn.textContent = rows.length ? `Create ${rows.length} product${rows.length === 1 ? '' : 's'}` : 'Create products';
    body.replaceChildren(...rows.map((r, i) => h('tr', {}, h('td', {}, h('img', { class: 'thumb', src: r.url, alt: '' })),
      h('td', {}, h('input', { value: r.name, maxlength: 120, 'aria-label': 'Name', oninput: (e) => { r.name = e.target.value; } })),
      h('td', {}, h('input', { value: r.code, maxlength: 30, 'aria-label': 'Code', oninput: (e) => { r.code = e.target.value; } })),
      h('td', {}, h('input', { value: r.alt, maxlength: 160, 'aria-label': 'Alt text', oninput: (e) => { r.alt = e.target.value; } })),
      h('td', {}, h('button', { class: 'btn sm danger', type: 'button', onclick: () => { rows.splice(i, 1); drawRows(); } }, 'Remove'))))); };
  const renumber = guard(async () => {
    const { next } = await api(`/products/next-code?prefix=${encodeURIComponent(val(prefix))}`);
    rows.forEach((r, i) => { r.code = `${val(prefix)}${next + i}`; }); drawRows();
  });
  async function addFiles(files) {
    const list = [...files].filter((f) => /^image\//.test(f.type)).slice(0, 60 - rows.length);
    if (!list.length) return;
    let done = 0;
    for (let i = 0; i < list.length; i += 4) {
      status1.textContent = `Uploading ${Math.min(i + 4, list.length)} of ${list.length}...`;
      const fd = new FormData(); list.slice(i, i + 4).forEach((f) => fd.append('files', f));
      const r = await api('/upload', { method: 'POST', form: fd });
      if (r.errors?.length) notify('err', r.errors.join(' '));
      for (const u of r.files) rows.push({ url: u.url, name: val(namePat), code: '', alt: '' }); done += r.files.length;
    }
    status1.textContent = `${done} photo${done === 1 ? '' : 's'} added. Check the names, codes and alt text below.`;
    if (rows.some((r) => !r.code)) { const { next } = await api(`/products/next-code?prefix=${encodeURIComponent(val(prefix))}`); let n = next; rows.forEach((r) => { if (!r.code) r.code = `${val(prefix)}${n++}`; }); }
    drawRows();
  }
  const picker = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true, onchange: guard(async (e) => { await addFiles(e.target.files); e.target.value = ''; }) });
  const drop = h('div', { class: 'drop', tabindex: '0', role: 'button', 'aria-label': 'Choose photos to upload' }, h('strong', {}, 'Drop photos here or click to choose'), h('span', { class: 'help' }, 'Up to 60 at once. One photo becomes one product. You can add more photos to each product later.'));
  drop.addEventListener('click', () => picker.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); } });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', guard(async (e) => { e.preventDefault(); drop.classList.remove('over'); await addFiles(e.dataTransfer.files); }));
  createBtn.addEventListener('click', guard(async () => {
    createBtn.disabled = true;
    const cats = catChecks.map((l) => l.firstChild).filter((c) => c.checked).map((c) => Number(c.value));
    const items = rows.map((r, i) => ({ code: r.code, name: r.name, description: '', fabric: val(fabric), sizes: val(sizes), colors: val(colors), moq: val(moq),
      photos: [{ url: r.url, alt: r.alt }], categories: cats, is_new: isNewCb.checked, is_featured: false, status: status.value, sort: 100 + i }));
    try { const r = await api('/products/bulk', { method: 'POST', body: { items } }); state.flash = ['ok', `${r.created} products created${status.value === 'draft' ? ' as drafts. Review them and publish when ready.' : '.'}`]; location.hash = '#/products'; }
    catch (e) { createBtn.disabled = false; throw e; }
  }));
  shell('Bulk add products', null,
    h('div', { class: 'card stack' }, h('h2', {}, 'Import product details from Excel'),
      h('p', { class: 'help' }, 'Upload an .xlsx workbook or .csv file with columns for code and name. Optional columns: description, fabric, sizes, colors, MOQ, categories (comma-separated). Import creates drafts without images; add photos later from each product editor. Up to 60 products per file.'),
      h('div', {}, templateLink, ' ', h('button', { class: 'btn sm', type: 'button', onclick: () => importFile.click() }, 'Choose spreadsheet'), importFile),
      importStatus, importTable, importButton),
    h('div', { class: 'card stack' }, h('h2', {}, '1. Details shared by all of them'), h('p', { class: 'help' }, 'Fill what is the same for the whole batch. You can fine-tune each product afterwards.'),
      h('div', { class: 'grid' }, prefix, namePat, fabric, sizes, colors, moq), h('div', { class: 'checks' }, catChecks), h('div', { class: 'grid' }, h('label', { class: 'f' }, 'Visibility', status)),
      h('div', { class: 'checks' }, h('label', {}, isNewCb, 'Mark all as New arrivals'))),
    h('div', { class: 'card stack' }, h('h2', {}, '2. Add the photos'), drop, picker, status1),
    h('div', { class: 'card stack', }, h('h2', {}, '3. Check and create'), h('p', { class: 'help' }, `Name each design and describe the photo for alt text. ${altHelp}`), table,
      h('div', {}, createBtn, ' ', h('button', { class: 'btn ghost', type: 'button', onclick: renumber }, 'Renumber codes from prefix'))));
}

  return { productsList, productEditor, bulkView };
}
