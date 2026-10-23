export function createUserPages(context) {
  const { state, h, api, notify, guard, fmtDate, shell, route } = context;

// ---------- users ----------
function modalForm(title, fields, submitLabel, onSubmit) {
  const dlg = h('dialog', { 'aria-label': title });
  const err = h('p', { class: 'msg err', role: 'alert', hidden: true });
  const form = h('form', { class: 'db stack' }, err, fields.map((x) => x.el), h('div', {}, h('button', { class: 'btn', type: 'submit' }, submitLabel), ' ', h('button', { class: 'btn ghost', type: 'button', onclick: () => { dlg.close(); } }, 'Cancel')));
  form.addEventListener('submit', async (e) => { e.preventDefault(); try { await onSubmit(); dlg.close(); } catch (ex) { err.textContent = ex.message; err.hidden = false; } });
  dlg.append(h('div', { class: 'dh' }, h('h2', {}, title)), form);
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}
async function usersView() {
  const { users } = await api('/users');
  const addBtn = h('button', { class: 'btn', type: 'button', onclick: () => {
    const email = h('input', { type: 'email', required: true, maxlength: 200, autocomplete: 'off' }), pw = h('input', { type: 'password', required: true, minlength: 12, autocomplete: 'new-password' });
    const role = h('select', {}, h('option', { value: 'editor' }, 'Editor: manages products, pages and enquiries'), h('option', { value: 'owner' }, 'Owner: can also manage users'));
    modalForm('Add a user', [{ el: h('label', { class: 'f' }, 'Email', email) }, { el: h('label', { class: 'f' }, 'Temporary password', pw, h('small', {}, 'At least 12 characters with letters and numbers. Share it safely, and ask them to change it.')) }, { el: h('label', { class: 'f' }, 'Role', role) }], 'Add user',
      async () => { await api('/users', { method: 'POST', body: { email: email.value, password: pw.value, role: role.value } }); state.flash = ['ok', 'User added.']; route(); });
  } }, '+ Add user');
  shell('Users', addBtn, h('div', { class: 'card' }, h('p', { class: 'help' }, 'Owners can manage users. Editors can do everything else except manage users and permanently delete products. Each person should have their own login.'),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Email', 'Role', 'Two-factor', 'Added', ''].map((t) => h('th', {}, t)))), h('tbody', {}, users.map((u) => h('tr', {},
      h('td', {}, u.email, u.you ? h('span', { class: 'tag' }, 'you') : null),
      h('td', {}, h('select', { 'aria-label': `Role for ${u.email}`, onchange: guard(async (e) => { try { await api(`/users/${u.id}`, { method: 'PATCH', body: { role: e.target.value } }); state.flash = ['ok', 'Role updated.']; } catch (ex) { state.flash = ['err', ex.message]; } route(); }) },
        ['owner', 'editor'].map((r) => h('option', { value: r, selected: r === u.role }, r)))),
      h('td', {}, h('span', { class: `tag ${u.totp_enabled ? 'pub' : 'draft'}` }, u.totp_enabled ? 'On' : 'Off')),
      h('td', {}, fmtDate(u.created_at)),
      h('td', {}, h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { const pw = h('input', { type: 'password', required: true, minlength: 12, autocomplete: 'new-password' });
          modalForm(`New password for ${u.email}`, [{ el: h('label', { class: 'f' }, 'New password', pw) }], 'Set password', async () => { await api(`/users/${u.id}`, { method: 'PATCH', body: { password: pw.value } }); state.flash = ['ok', 'Password changed and that user was signed out.']; route(); }); } }, 'Reset password'), ' ',
        u.totp_enabled ? h('button', { class: 'btn sm ghost', type: 'button', onclick: guard(async () => { if (!confirm(`Turn off two-factor for ${u.email}? They will be signed out.`)) return; await api(`/users/${u.id}/reset-2fa`, { method: 'POST' }); route(); }) }, 'Reset 2FA') : null, ' ',
        u.you ? null : h('button', { class: 'btn sm danger', type: 'button', onclick: guard(async () => { if (!confirm(`Delete ${u.email}?`)) return; await api(`/users/${u.id}`, { method: 'DELETE' }); route(); }) }, 'Delete')))))))));
}

  return { usersView };
}
