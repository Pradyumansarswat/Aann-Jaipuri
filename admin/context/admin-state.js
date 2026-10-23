export function createAdminState() {
  return {
    csrf: '',
    user: null,
    flash: null,
    newCount: 0,
    noticeElement: null,
  };
}
