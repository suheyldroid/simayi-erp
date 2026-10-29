// Core Better Auth only. Add plugin schemas explicitly before enabling plugins.
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const auth = betterAuth({
  secret: required('BETTER_AUTH_SECRET'),
  baseURL: required('BETTER_AUTH_URL'),
  trustedOrigins: [required('PUBLIC_APP_ORIGIN')],
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  advanced: { database: { generateId: () => crypto.randomUUID() } },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    // Implement provisioning/invitations and sendResetPassword before rollout.
    // Do not copy Django password hashes into Account.password.
  },
  user: {
    additionalFields: {
      isActive: { type: 'boolean', defaultValue: true, input: false },
      isStaff: { type: 'boolean', defaultValue: false, input: false },
      isSuperuser: { type: 'boolean', defaultValue: false, input: false },
    },
  },
});

// Prisma model/field names match Better Auth's defaults. SQL @@map/@map names
// do not require Better Auth modelName/fields overrides.
