export abstract class MidcontractProtocolError extends Error {
  constructor(message?: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  override toString(): string {
    return [this.name, this.message].join(" ").trim();
  }
}

export class CoreMidcontractProtocolError extends MidcontractProtocolError {}

export class UserMidcontractProtocolError extends MidcontractProtocolError {}

export class NotSupportError extends UserMidcontractProtocolError {
  override name = "not support";
}

export class NotFoundError extends UserMidcontractProtocolError {
  override name = "not found";
}

export class NotMatchError extends UserMidcontractProtocolError {
  override name = "not match";
}

export class NotEnoughError extends UserMidcontractProtocolError {
  override name = "not enough";
}

export class NotSuccessTransactionError extends UserMidcontractProtocolError {
  override name = "not success transaction";
}

export class NotSetError extends UserMidcontractProtocolError {
  override name = "not set";
}

export class SimulateError extends UserMidcontractProtocolError {
  override name = "simulate";
}

export function parseMessageError(error: unknown | Error, message = ""): string {
  if (error instanceof Error) {
    return error.message ? error.message : message;
  } else {
    return `${message ? message + ": " : ""}unknown ${JSON.stringify(error)}`;
  }
}

export function parseError(error: unknown | Error, message = ""): string {
  let out = "";
  if (error instanceof MidcontractProtocolError) {
    out = `${error.name}: ${error.message ? error.message : message}`;
  } else if (error instanceof Error) {
    out = error.message;
  } else {
    out = parseMessageError(error, message);
  }
  return out;
}
