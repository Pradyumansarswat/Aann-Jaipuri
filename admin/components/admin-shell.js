const NAVIGATION = [
  ['Overview', [['#/dashboard', 'Dashboard']]],
  ['Catalogue', [['#/products', 'Products'], ['#/bulk', 'Bulk add'], ['#/trash', 'Trash'], ['#/categories', 'Categories'], ['#/media', 'Images'], ['#/catalogue', 'Catalogue PDF']]],
  ['Website pages', [['#/content/home', 'Home page'], ['#/content/about', 'About page'], ['#/content/brand', 'Brand and contact'], ['#/content/catalogue', 'Catalogue page text'], ['#/content/legal', 'Legal pages and GST'], ['#/content/seo', 'Search and sharing']]],
  ['Customers', [['#/enquiries', 'Enquiries']]],
  ['Account', [['#/account', 'Password and security'], ['#/users', 'Users', true]]],
];

export function createAdminShell({ app, state, h, api, guard, onLogout }) {
  return function renderShell(title, actions, ...content) {
    const currentRoute = location.hash.split('?')[0] || '#/dashboard';
    state.noticeElement = h('div', { 'aria-live': 'polite' });
    if (state.flash) {
      const [type, message] = state.flash;
      state.flash = null;
      state.noticeElement.append(h('div', { class: `msg ${type}`, role: 'status' }, message));
    }

    const sidebar = h('aside', { class: 'side' },
      h('div', { class: 'brand' }, 'Site manager', h('small', {}, state.user.email)),
      h('nav', {}, NAVIGATION.map(([group, items]) => [
        h('h4', {}, group),
        items.filter(([, , ownerOnly]) => !ownerOnly || state.user.role === 'owner')
          .map(([href, label]) => h('a', {
            href,
            class: currentRoute === href || (href !== '#/dashboard' && currentRoute.startsWith(href + '/')) ? 'on' : '',
          }, label, href === '#/enquiries' && state.newCount
            ? h('span', { class: 'pill' }, state.newCount)
            : null)),
      ])));

    const main = h('main', { class: 'main' },
      h('div', { class: 'top' }, h('h1', {}, title),
        h('div', { class: 'acts' }, actions,
          h('a', { class: 'btn ghost', href: '/', target: '_blank', rel: 'noopener' }, 'View website'),
          h('button', {
            class: 'btn ghost',
            type: 'button',
            onclick: guard(async () => {
              await api('/logout', { method: 'POST' });
              state.user = null;
              state.csrf = '';
              onLogout();
            }),
          }, 'Sign out'))),
      state.noticeElement,
      content);

    app.replaceChildren(h('div', { class: 'shell' }, sidebar, main));
    document.title = `${title} | Site manager`;
    return main;
  };
}
