import env, { isProduction, trustedOrigins } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { MediaFilesService } from "@/modules/media/service";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, openAPI, organization } from "better-auth/plugins";
import createError from "http-errors";

/** A rejected media input becomes the native 400 instead of a handler crash. */
function rethrowBadRequest(error: unknown): never {
  if (createError.isHttpError(error) && error.status === 400)
    throw new APIError("BAD_REQUEST", { message: error.message });
  throw error;
}

/** Target user id from an admin update body, when the endpoint provides one. */
function bodyUserId(context: unknown): string | null {
  if (typeof context !== "object" || context === null || !("body" in context))
    return null;
  const body = context.body;
  if (typeof body !== "object" || body === null || !("userId" in body))
    return null;
  return typeof body.userId === "string" ? body.userId : null;
}

// Better Auth's CLI requires a named auth configuration export.
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  basePath: "/auth",
  trustedOrigins,
  // Closed at the HTTP boundary: creating/sending an invitation and the
  // resend flag both resolve to POST /organization/invite-member.
  disabledPaths: ["/organization/invite-member"],
  advanced: {
    useSecureCookies: isProduction,
    // Prisma models take an application-supplied String id, so generate the UUID instead of deferring to the database.
    database: { generateId: () => crypto.randomUUID() },
  },
  // Better Auth enables rate limiting in production by default; keep it off explicitly.
  rateLimit: { enabled: false },
  session: { cookieCache: { enabled: false }, expiresIn: 60 * 60 * 24 * 7 },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      isActive: { type: "boolean", defaultValue: true, input: false },
    },
  },
  databaseHooks: {
    user: {
      update: {
        // Early guard only; the `user_avatar_media` trigger performs the
        // authoritative claim/release inside the native user write. Admin
        // updates resolve their target from the endpoint body, self-service
        // updates from the session.
        async before(data, context) {
          if (data.image === undefined) return;
          const targetId =
            bodyUserId(context) ?? context?.context?.session?.user.id ?? null;
          try {
            await MediaFilesService.assertAvatarUpdate({
              targetId,
              image: data.image,
            });
          } catch (error) {
            rethrowBadRequest(error);
          }
        },
      },
    },
  },
  plugins: [
    admin(),
    organization({
      // Native owner/admin/member roles only; no dynamic access control.
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
      membershipLimit: 10000,
      teams: { enabled: true, allowRemovingAllTeams: true },
      // Logo values are validated here for an early 400; the authoritative
      // claim/release happens inside the native organization write through the
      // `organization_logo_media` database trigger, so a request can never
      // commit a logo it no longer owns. Native permissions, transactions,
      // roles, and response shapes stay untouched.
      organizationHooks: {
        async beforeCreateOrganization({ organization, user }) {
          try {
            await MediaFilesService.assertCreateLogo(
              user.id,
              organization.logo,
            );
          } catch (error) {
            rethrowBadRequest(error);
          }
        },
        async beforeUpdateOrganization({ organization, user, member }) {
          try {
            await MediaFilesService.assertUpdateLogo({
              userId: user.id,
              organizationId: member.organizationId,
              logo: organization.logo,
            });
          } catch (error) {
            rethrowBadRequest(error);
          }
        },
      },
    }),
    ...(!isProduction ? [openAPI({ disableDefaultReference: true })] : []),
  ],
});
