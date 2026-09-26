// Operational errors carry an HTTP status and a user-facing message.
export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(msg, details) { return new AppError(400, msg, details); }
  static unauthorized(msg = 'Authentication required') { return new AppError(401, msg); }
  static forbidden(msg = 'You do not have access to this resource') { return new AppError(403, msg); }
  static notFound(what = 'Resource', details) {
    const lower = what.toLowerCase();
    const msg = lower.includes('not found') || lower.includes('no account') || lower.includes('found')
      ? what
      : `${what} not found`;
    return new AppError(404, msg, details);
  }
  static conflict(msg, details) { return new AppError(409, msg, details); }
}
