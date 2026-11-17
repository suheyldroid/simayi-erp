import { t } from "elysia";

export const meResponseSchema = t.Object({
  user: t.Object({
    id: t.String(),
    name: t.String(),
    email: t.String(),
    emailVerified: t.Boolean(),
    isActive: t.Boolean(),
    role: t.String(),
    image: t.Union([t.String(), t.Null()]),
  }),
  session: t.Object({
    id: t.String(),
    activeOrganizationId: t.Union([t.String(), t.Null()]),
    activeTeamId: t.Union([t.String(), t.Null()]),
  }),
});
