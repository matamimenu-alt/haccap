export type BilingualMessage = { ar: string; en: string };

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly bilingual: BilingualMessage;
  public readonly details?: unknown;

  constructor(opts: {
    status: number;
    code: string;
    message: BilingualMessage;
    details?: unknown;
  }) {
    super(opts.message.en);
    this.name = 'AppError';
    this.status = opts.status;
    this.code = opts.code;
    this.bilingual = opts.message;
    this.details = opts.details;
  }
}

export const errors = {
  unauthorized: (msg?: Partial<BilingualMessage>) =>
    new AppError({
      status: 401,
      code: 'UNAUTHORIZED',
      message: {
        ar: msg?.ar ?? 'يرجى تسجيل الدخول للمتابعة',
        en: msg?.en ?? 'Authentication required',
      },
    }),
  forbidden: (msg?: Partial<BilingualMessage>) =>
    new AppError({
      status: 403,
      code: 'FORBIDDEN',
      message: {
        ar: msg?.ar ?? 'ليس لديك صلاحية لهذا الإجراء',
        en: msg?.en ?? 'You do not have permission to perform this action',
      },
    }),
  notFound: (entity: string, msg?: Partial<BilingualMessage>) =>
    new AppError({
      status: 404,
      code: 'NOT_FOUND',
      message: {
        ar: msg?.ar ?? `${entity} غير موجود`,
        en: msg?.en ?? `${entity} not found`,
      },
    }),
  badRequest: (msg: BilingualMessage, details?: unknown) =>
    new AppError({ status: 400, code: 'BAD_REQUEST', message: msg, details }),
  validation: (details: unknown) =>
    new AppError({
      status: 422,
      code: 'VALIDATION_FAILED',
      message: {
        ar: 'بيانات غير صالحة',
        en: 'Validation failed',
      },
      details,
    }),
  conflict: (msg: BilingualMessage) =>
    new AppError({ status: 409, code: 'CONFLICT', message: msg }),
  internal: (msg?: Partial<BilingualMessage>) =>
    new AppError({
      status: 500,
      code: 'INTERNAL',
      message: {
        ar: msg?.ar ?? 'حدث خطأ غير متوقع',
        en: msg?.en ?? 'An unexpected error occurred',
      },
    }),
};
