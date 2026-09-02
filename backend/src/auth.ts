import { Request, Response, NextFunction } from 'express';

// Single shared admin key, sent as `x-admin-key`. Fine for a small
// self-hosted service with one or two curators; move to per-user auth if
// you add more than a couple of reviewers.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const configured = process.env.ADMIN_API_KEY;
  if (!configured) {
    res.status(500).json({ error: 'Server misconfigured: ADMIN_API_KEY is not set.' });
    return;
  }
  const provided = req.header('x-admin-key');
  if (!provided || provided !== configured) {
    res.status(401).json({ error: 'Missing or invalid x-admin-key header.' });
    return;
  }
  next();
}
