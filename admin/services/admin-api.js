export function createAdminApi({ state, onUnauthorized }) {
  return async function api(path, { method = 'GET', body, form } = {}) {
    const headers = { Accept: 'application/json' };
    if (state.csrf) headers['X-CSRF-Token'] = state.csrf;

    let payload;
    if (form) payload = form;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const response = await fetch(`/api/admin${path}`, {
      method,
      headers,
      body: payload,
      credentials: 'same-origin',
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401 && path !== '/login' && path !== '/login/2fa') {
      state.user = null;
      state.csrf = '';
      onUnauthorized(data.error);
      throw new Error(data.error || 'Signed out');
    }
    if (!response.ok) {
      throw Object.assign(new Error(data.error || 'Something went wrong.'), { data });
    }
    return data;
  };
}
