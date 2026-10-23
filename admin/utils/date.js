export function formatDate(value) {
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
