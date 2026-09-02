import { Request, Response, NextFunction, RequestHandler } from 'express';

// Express 4 does not catch rejected promises from async route handlers —
// an unhandled rejection there leaves the client connection hanging (or
// worse, crashes the process) instead of producing a normal error
// response. Wrap every async handler with this so failures reach the
// error-handling middleware in server.ts.
export function ah(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
