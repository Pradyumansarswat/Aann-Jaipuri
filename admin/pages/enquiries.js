export function createEnquiryPages(context) {
  const { state, h, api, notify, guard, fmtDate, shell, route } = context;

  // ---------- enquiries ----------
  async function enquiriesView() {
    const sel = h('select', { 'aria-label': 'Filter' }, ['', 'new', 'contacted', 'closed'].map((v) => h('option', { value: v }, v || 'All enquiries')));
    const list = h('div', { class: 'card' });
    shell('Enquiries', h('a', { class: 'btn ghost', href: '/api/admin/enquiries.csv' }, 'Download CSV'), h('div', { class: 'filters' }, sel), list);
    const load = guard(async () => {
      const { enquiries } = await api(`/enquiries?status=${sel.value}`);
      state.newCount = enquiries.filter((e) => e.status === 'new').length;
      list.replaceChildren(...(enquiries.length ? enquiries.map((e) => h('div', { class: 'enq' },
        h('div', { class: 'top' }, h('div', {}, h('strong', {}, `${e.name}, ${e.shop}`), e.source === 'catalogue' ? h('span', { class: 'tag' }, 'catalogue request') : null, h('br'), `${e.city}${e.phone ? ' | ' + e.phone : ''}${e.email ? ' | ' + e.email : ''}`, h('br'), h('span', { class: 'help' }, `${fmtDate(e.created_at)}${e.buyer_type ? ' | ' + e.buyer_type : ''}${e.product_code ? ' | Design ' + e.product_code : ''}`)),
          h('div', { class: 'acts' }, h('select', { 'aria-label': 'Status', onchange: guard(async (ev) => { await api(`/enquiries/${e.id}`, { method: 'PATCH', body: { status: ev.target.value } }); load(); }) },
            ['new', 'contacted', 'closed'].map((s) => h('option', { value: s, selected: s === e.status }, s))),
            e.phone ? h('a', { class: 'btn sm ghost', href: `https://wa.me/${e.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`, target: '_blank', rel: 'noopener noreferrer' }, 'WhatsApp') : null,
            h('button', { class: 'btn sm danger', type: 'button', onclick: guard(async () => { if (!confirm('Delete this enquiry?')) return; await api(`/enquiries/${e.id}`, { method: 'DELETE' }); load(); }) }, 'Delete'))),
        h('pre', {}, e.requirement))) : [h('p', { class: 'help' }, 'No enquiries here.')]));
    });
    sel.addEventListener('change', load); load();
  }

  return { enquiriesView };
}
