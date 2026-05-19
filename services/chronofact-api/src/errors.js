export class ChronofactError extends Error {
  constructor(code, message, statusCode = 400, details = undefined) {
    super(message);
    this.name = "ChronofactError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function isChronofactError(error) {
  return error instanceof ChronofactError;
}
