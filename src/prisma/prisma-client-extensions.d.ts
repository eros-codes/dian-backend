/* eslint-disable */
// Temporary type augmentation: ensures TypeScript recognizes
// the generated Prisma model delegates (added by migration).
// This file is a stop-gap until `prisma generate` is run and
// the real types are available in `@prisma/client`.

declare module '@prisma/client' {
   
  interface PrismaClient {
    // These will be replaced by the actual generated types after `prisma generate`.
    sharedCart: any;
    sharedCartItem: any;
  }
}

export {};
