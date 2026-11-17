import { Elysia } from "elysia";
import { auth } from "./auth";
import { meResponseSchema } from "./model";
import { authPlugin } from "./plugin";

export const authController = new Elysia({ name: "auth-controller" })
  .mount(auth.handler)
  .use(authPlugin)
  .get(
    "/me",
    ({ user, session }) => ({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
        role: user.role ?? "user",
        image: user.image ?? null,
      },
      session: {
        id: session.id,
        activeOrganizationId: session.activeOrganizationId ?? null,
        activeTeamId: session.activeTeamId ?? null,
      },
    }),
    {
      auth: true,
      response: meResponseSchema,
      detail: {
        tags: ["Auth"],
        summary: "Current session user",
        security: [{ cookieAuth: [] }],
      },
    },
  );
