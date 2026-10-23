export function createAccountPages(context) {
  const { state, h, api, notify, guard, fmtDate, shell, route } = context;

// ---------- account ----------
async function accountView() {
  const me = await api('/me'); state.user = me.user;
  const cur = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
  const nw = h('input', { type: 'password', required: true, autocomplete: 'new-password', minlength: 12 });
  const form = h('form', { class: 'card stack' }, h('h2', {}, 'Change password'), h('p', { class: 'help' }, 'Use at least 12 characters with letters and numbers. Changing it signs out other devices.'),
    h('label', { class: 'f' }, 'Current password', cur), h('label', { class: 'f' }, 'New password', nw), h('div', {}, h('button', { class: 'btn', type: 'submit' }, 'Update password')));
  form.addEventListener('submit', guard(async (e) => { e.preventDefault(); await api('/password', { method: 'POST', body: { current: cur.value, next: nw.value } }); cur.value = nw.value = ''; notify('ok', 'Password updated.'); }));

  const tf = h('div', { class: 'card stack' });
  const drawOff = () => {
    const pw = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
    const f = h('form', { class: 'stack' }, h('h2', {}, 'Two-factor sign-in'), h('p', { class: 'help' }, 'Adds a 6-digit code from your phone to every sign-in, so a stolen password alone is not enough. Works with Google Authenticator, Microsoft Authenticator, Authy and 1Password.'),
      h('label', { class: 'f' }, 'Your password, to confirm it is you', pw), h('div', {}, h('button', { class: 'btn', type: 'submit' }, 'Set up two-factor')));
    f.addEventListener('submit', guard(async (e) => {
      e.preventDefault();
      const r = await api('/2fa/setup', { method: 'POST', body: { password: pw.value } });
      const code = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, required: true, pattern: '[0-9]{6}', 'aria-label': '6-digit code' });
      const f2 = h('form', { class: 'stack' }, h('h2', {}, 'Scan this with your authenticator app'), h('img', { class: 'qr', src: r.qr, alt: 'QR code for your authenticator app', width: 220, height: 220 }),
        h('p', { class: 'help' }, 'Cannot scan? Enter this key by hand: ', h('code', {}, r.secret.match(/.{1,4}/g).join(' '))),
        h('label', { class: 'f' }, 'Then type the 6-digit code it shows', code), h('div', {}, h('button', { class: 'btn', type: 'submit' }, 'Turn on two-factor')));
      f2.addEventListener('submit', guard(async (e2) => {
        e2.preventDefault();
        const done = await api('/2fa/enable', { method: 'POST', body: { code: code.value } });
        state.user.totp = true;
        const text = done.recoveryCodes.join('\n');
        tf.replaceChildren(h('h2', {}, 'Two-factor is on'), h('div', { class: 'msg ok' }, 'Save these recovery codes somewhere safe, such as a password manager. Each works once if you lose your phone. They will not be shown again.'),
          h('pre', { class: 'codes' }, text), h('div', { class: 'acts' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => navigator.clipboard?.writeText(text).then(() => notify('ok', 'Copied.')) }, 'Copy codes'),
            h('button', { class: 'btn', type: 'button', onclick: () => route() }, 'I have saved them')));
      }));
      tf.replaceChildren(f2);
    }));
    tf.replaceChildren(f);
  };
  const drawOn = () => {
    const pw = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
    const code = h('input', { type: 'text', required: true, autocomplete: 'one-time-code', maxlength: 20 });
    const f = h('form', { class: 'stack' }, h('h2', {}, 'Two-factor sign-in'), h('p', {}, h('span', { class: 'tag pub' }, 'On'), ' Every sign-in asks for a code from your phone.'),
      h('p', { class: 'help' }, 'To turn it off, confirm with your password and a current code.'), h('label', { class: 'f' }, 'Password', pw), h('label', { class: 'f' }, 'Code or recovery code', code),
      h('div', {}, h('button', { class: 'btn danger', type: 'submit' }, 'Turn off two-factor')));
    f.addEventListener('submit', guard(async (e) => { e.preventDefault(); await api('/2fa/disable', { method: 'POST', body: { password: pw.value, code: code.value } }); state.flash = ['ok', 'Two-factor turned off.']; route(); }));
    tf.replaceChildren(f);
  };
  state.user.totp ? drawOn() : drawOff();
  shell('Password and security', null, tf, form, h('div', { class: 'card' }, h('h2', {}, 'Security notes'), h('ul', {}, h('li', {}, 'Sessions expire after 2 hours of inactivity.'), h('li', {}, 'After 5 wrong passwords or codes, sign-in is paused for 15 minutes.'), h('li', {}, 'Uploaded photos are re-encoded and stripped of location data.'))));
}

  return { accountView };
}
