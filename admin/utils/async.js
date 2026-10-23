export function createGuard(notify) {
  return (handler) => async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error.message !== 'Signed out') notify('err', error.message);
    }
  };
}
