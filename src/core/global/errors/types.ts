export type ErrorResponse = {
  errorType: ErrorType;
  errorMessage: string;
  success: boolean;
  errors: string[] | null;
  errorRaw: any;
  errorsValidation: ErrorValidation[] | null;
  stack?: string;
};

export type ErrorType =
  | "BadRequest"
  | "InternalServer"
  | "Raw"
  | "Validation"
  | "Unauthorized"
  | "Forbidden"
  | "NotFound"
  | "Conflict"
  | "NotImplemented"
  | "BadGateway"
  | "ServiceUnavailable"
  | "GatewayTimeout"
  | "Timeout";

export type ErrorValidation = { [key: string]: string };
