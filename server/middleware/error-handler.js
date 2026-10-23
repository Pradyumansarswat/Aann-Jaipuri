export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);

  const message = status === 500
    ? 'Something went wrong on our side. Please try again.'
    : err.type === 'entity.parse.failed' ? 'Invalid request.' : err.message;

  if (req.originalUrl.startsWith('/api/') || req.get('accept')?.includes('json')) {
    return res.status(status).json({ error: message });
  }
  return res.status(status).type('text').send(message);
}
