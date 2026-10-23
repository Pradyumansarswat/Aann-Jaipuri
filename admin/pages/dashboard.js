export function createDashboardPages(context) {
  const { state, h, api, notify, guard, fmtDate, shell, route } = context;

// ---------- dashboard ----------
async function dashboard() {
  const s = await api('/stats');
  state.newCount = s.newEnquiries;
  const pop = s.popular;
  const checks = s.setup.filter((c) => !c.ownerOnly || state.user.role === 'owner');
  shell('Dashboard', null,
    s.warnings.map((w) => h('div', { class: 'warn' }, w.text, ' ', h('a', { href: w.section === 'products' ? '#/products/new' : `#/content/${w.section}` }, 'Fix now'))),
    h('div', { class: 'cards' }, [['Published designs', s.products], ['Drafts', s.drafts], ['Categories', s.categories], ['New enquiries', s.newEnquiries], ['In Trash', s.trash]].map(([l, n]) => h('div', { class: 'stat' }, h('b', {}, n), h('span', {}, l)))),
    h('div', { class: 'card' }, h('h2', {}, 'Which designs get attention'),
      h('p', { class: 'help' }, `Last ${pop.days} days. ${pop.totals.views} product page views and ${pop.totals.enquiries} enquiry button clicks. Counted without cookies or personal data${s.analyticsProvider ? `; full visitor reports are in your ${s.analyticsProvider === 'plausible' ? 'Plausible' : 'Umami'} dashboard` : ''}.`),
      pop.designs.length ? h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['', 'Design', 'Views', 'Enquiry clicks'].map((t) => h('th', {}, t)))), h('tbody', {}, pop.designs.map((d) =>
        h('tr', {}, h('td', {}, h('img', { class: 'thumb', src: d.image, alt: '' })), h('td', {}, h('strong', {}, d.name), h('br'), d.code), h('td', {}, d.views), h('td', {}, d.enquiries))))))
        : h('p', { class: 'help' }, 'No visits counted yet. Numbers appear as buyers open product pages.')),
    h('div', { class: 'card' }, h('h2', {}, 'Go-live checklist'), h('ul', { class: 'checklist' }, checks.map((c) =>
      h('li', { class: c.ok ? 'done' : '' }, h('span', { 'aria-hidden': 'true' }, c.ok ? '\u2713' : '\u25cb'), ' ', c.label, c.ok ? null : h('small', {}, ` (${c.hint})`))))),
    h('div', { class: 'card' }, h('h2', {}, 'Latest enquiries'), s.recent.length ? h('div', { class: 'scroll' }, h('table', {}, h('tbody', {}, s.recent.map((e) =>
      h('tr', {}, h('td', {}, fmtDate(e.created_at)), h('td', {}, `${e.name}, ${e.shop}, ${e.city}`), h('td', {}, e.source === 'catalogue' ? h('span', { class: 'tag' }, 'catalogue') : null, h('span', { class: `tag ${e.status === 'new' ? 'new' : ''}` }, e.status)))))))
      : h('p', { class: 'help' }, 'No enquiries yet. They appear here when visitors use the contact form.'), h('p', {}, h('a', { href: '#/enquiries' }, 'See all enquiries'))),
    h('div', { class: 'card' }, h('h2', {}, 'Recent activity'), h('div', { class: 'scroll' }, h('table', {}, h('tbody', {}, s.audit.map((a) =>
      h('tr', {}, h('td', {}, fmtDate(a.at)), h('td', {}, a.user_email || 'visitor'), h('td', {}, a.action), h('td', {}, a.detail))))))));
}

  return { dashboard };
}
