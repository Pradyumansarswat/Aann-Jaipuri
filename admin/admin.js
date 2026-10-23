import { createAdminShell } from './components/admin-shell.js';
import { createAdminPages } from './pages/index.js';
import { createAdminApi } from './services/admin-api.js';
import { createAdminState } from './context/admin-state.js';
import { createGuard } from './utils/async.js';
import { createElement } from './utils/dom.js';
import { formatDate } from './utils/date.js';

(() => {
  'use strict';

  const app = document.getElementById('app');
  const state = createAdminState();
  const h = createElement;
  const notify = (type, text) => {
    if (!state.noticeElement) return;
    state.noticeElement.replaceChildren(h('div', {
      class: `msg ${type}`,
      role: type === 'err' ? 'alert' : 'status',
    }, text));
    state.noticeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (type === 'ok') {
      setTimeout(() => state.noticeElement && state.noticeElement.replaceChildren(), 4000);
    }
  };
  const guard = createGuard(notify);

  function showLogin(message) {
    const error = h('p', { class: 'msg err', role: 'alert', hidden: !message }, message || '');
    const email = h('input', { type: 'email', required: true, autocomplete: 'username', maxlength: 200 });
    const password = h('input', { type: 'password', required: true, autocomplete: 'current-password', maxlength: 200 });
    const submit = h('button', { class: 'btn', type: 'submit' }, 'Sign in');
    const form = h('form', { class: 'login' },
      h('h1', {}, 'Site manager'),
      h('p', { class: 'help' }, 'Sign in to manage products, pages and enquiries.'),
      error,
      h('label', { class: 'f' }, 'Email', email),
      h('label', { class: 'f' }, 'Password', password),
      submit);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      error.hidden = true;
      try {
        const result = await api('/login', {
          method: 'POST',
          body: { email: email.value, password: password.value },
        });
        if (result.needs2fa) return showCode(result.ticket);
        state.user = result.user;
        state.csrf = result.csrf;
        route();
      } catch (exception) {
        error.textContent = exception.message;
        error.hidden = false;
        submit.disabled = false;
        password.value = '';
        password.focus();
      }
    });

    app.replaceChildren(form);
    email.focus();
  }

  function showCode(ticket) {
    const error = h('p', { class: 'msg err', role: 'alert', hidden: true });
    const code = h('input', {
      type: 'text',
      inputmode: 'text',
      required: true,
      autocomplete: 'one-time-code',
      maxlength: 20,
      'aria-describedby': 'codehelp',
    });
    const submit = h('button', { class: 'btn', type: 'submit' }, 'Verify');
    const form = h('form', { class: 'login' },
      h('h1', {}, 'Two-step sign in'),
      h('p', { class: 'help', id: 'codehelp' }, 'Open your authenticator app and enter the 6-digit code. Lost your phone? Use one of your recovery codes instead.'),
      error,
      h('label', { class: 'f' }, 'Code', code),
      submit,
      h('button', { class: 'btn ghost', type: 'button', onclick: () => showLogin() }, 'Back'));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      error.hidden = true;
      try {
        const result = await api('/login/2fa', {
          method: 'POST',
          body: { ticket, code: code.value },
        });
        state.user = result.user;
        state.csrf = result.csrf;
        if (result.recoveryLeft !== undefined) {
          state.flash = ['ok', `You signed in with a recovery code. ${result.recoveryLeft} left. Turn two-factor off and on again to get a fresh set.`];
        }
        route();
      } catch (exception) {
        if (/expired/i.test(exception.message)) return showLogin(exception.message);
        error.textContent = exception.message;
        error.hidden = false;
        submit.disabled = false;
        code.value = '';
        code.focus();
      }
    });

    app.replaceChildren(form);
    code.focus();
  }

  const api = createAdminApi({ state, onUnauthorized: showLogin });
  const shell = createAdminShell({
    app,
    state,
    h,
    api,
    guard,
    onLogout: () => showLogin(),
  });
  const pages = createAdminPages({ state, h, api, notify, guard, fmtDate: formatDate, shell, route: () => route() });

  async function route() {
    if (!state.user) {
      try {
        const result = await api('/me');
        state.user = result.user;
        state.csrf = result.csrf;
      } catch {
        return showLogin();
      }
    }

    const [, section, item] = (location.hash || '#/dashboard').split('?')[0].split('/');
    try {
      if (!state.newCount && section !== 'dashboard') {
        api('/stats').then((result) => { state.newCount = result.newEnquiries; }).catch(() => {});
      }
      if (section === 'products') return item ? await pages.productEditor(item) : await pages.productsList();
      if (section === 'bulk') return await pages.bulkView();
      if (section === 'trash') return await pages.trashView();
      if (section === 'catalogue') return await pages.catalogueView();
      if (section === 'users') return state.user.role === 'owner' ? await pages.usersView() : await pages.dashboard();
      if (section === 'categories') return await pages.categoriesView();
      if (section === 'content') return await pages.contentView(item);
      if (section === 'enquiries') return await pages.enquiriesView();
      if (section === 'media') return await pages.mediaView();
      if (section === 'account') return await pages.accountView();
      return await pages.dashboard();
    } catch (error) {
      if (error.message !== 'Signed out') {
        shell('Something went wrong', null, h('div', { class: 'msg err' }, error.message));
      }
    }
  }

  addEventListener('hashchange', () => {
    if (state.user) route();
  });
  route();
})();
