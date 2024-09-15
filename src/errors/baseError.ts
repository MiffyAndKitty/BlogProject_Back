export class BaseError<T extends string> extends Error {
  name: T;
  message: string;
  code: number;
  cause?: any;

  constructor({
    name,
    message,
    code,
    cause
  }: {
    name: T;
    message: string;
    code: number;
    cause?: any;
  }) {
    super(message);
    this.name = name;
    this.message = message;
    this.code = code;
    this.cause = cause;
  }
}
