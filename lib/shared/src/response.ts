// Standard API response envelope
export type Meta = {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  [k: string]: unknown;
};

export type ApiSuccess<T> = { success: true; data: T; meta?: Meta };
export type ApiError = {
  success: false;
  error: {
    code: string;
    message: { ar: string; en: string };
    details?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const ok = <T>(data: T, meta?: Meta): ApiSuccess<T> => ({
  success: true,
  data,
  ...(meta ? { meta } : {}),
});
