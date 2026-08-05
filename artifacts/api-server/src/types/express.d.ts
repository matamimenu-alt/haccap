// Augments the global Express namespace with the tenant context that
// `requireAuth` (see src/middleware/auth.ts) attaches to every
// authenticated request.
//
// This file intentionally has no top-level import/export statements,
// which makes TypeScript treat it as an ambient "script" rather than a
// module. That lets `declare namespace Express` merge directly with the
// Express.Request interface shipped by @types/express, without needing
// to be explicitly imported anywhere — it's picked up automatically via
// the "src/**/*" include glob in tsconfig.json.
declare namespace Express {
  interface Request {
    tenant?: {
      userId: string;
      companyId: string;
      roles: string[];
      branchIds: string[];
    };
  }
}
