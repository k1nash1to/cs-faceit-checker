/** Ошибки, которые умеют превращаться в понятный JSON-ответ. */

export class UserInputError extends Error {
  constructor(message, hint = null) {
    super(message);
    this.name = 'UserInputError';
    this.status = 400;
    this.hint = hint;
  }
}

export class UpstreamError extends Error {
  constructor(service, status, details = null) {
    super(`${service} upstream error (${status})`);
    this.name = 'UpstreamError';
    this.service = service;
    this.status = status;
    this.details = details;
  }
}
