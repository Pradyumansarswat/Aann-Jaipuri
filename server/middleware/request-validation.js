export const fail = (res, status, error, fields) => res.status(status).json({ error, fields });

export function firstIssue(error) {
  const issue = error.issues[0];
  return `${issue.path.length ? `${issue.path.join(' > ')}: ` : ''}${issue.message}`;
}

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return fail(res, 400, firstIssue(result.error));
    req.data = result.data;
    next();
  };
}

export function validateId(req, res, next) {
  const value = Number(req.params.id);
  if (!Number.isInteger(value) || value < 1) return fail(res, 400, 'Invalid id.');
  req.id = value;
  next();
}
