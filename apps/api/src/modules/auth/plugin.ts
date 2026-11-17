import { BRANCH_HEADER, ORGANIZATION_HEADER } from "@/lib/tenant";
import { organizationMismatch } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { BranchesService } from "@/modules/branches/service";
import { Elysia } from "elysia";
import createError, { Unauthorized } from "http-errors";
import { auth } from "./auth";

export const authPlugin = new Elysia({ name: "better-auth" }).macro({
  auth: {
    async resolve({ request: { headers } }) {
      const session = await auth.api.getSession({ headers });
      if (!session || !session.user.isActive || session.user.banned)
        throw new Unauthorized();
      const expected = headers.get(ORGANIZATION_HEADER);
      if (
        expected !== null &&
        expected !== (session.session.activeOrganizationId ?? "")
      )
        throw organizationMismatch();
      return { user: session.user, session: session.session };
    },
  },
  tenant: {
    async resolve({ request: { headers } }) {
      const session = await auth.api.getSession({ headers });
      if (!session || !session.user.isActive || session.user.banned)
        throw new Unauthorized();
      const expected = headers.get(ORGANIZATION_HEADER);
      if (
        expected !== null &&
        expected !== (session.session.activeOrganizationId ?? "")
      )
        throw organizationMismatch();
      const organizationId = session.session.activeOrganizationId;
      if (!organizationId)
        throw new createError.BadRequest("Active organization required");
      const member = await prisma.member.findFirst({
        where: { userId: session.user.id, organizationId },
        select: { id: true },
      });
      if (!member)
        throw new createError.Forbidden("Organization membership required");
      // The optional branch header is resolved inside the verified company;
      // absent means company context and no branch is chosen implicitly. An
      // inactive branch still resolves for reads and history; write services
      // re-check activation under the branch lifecycle lock.
      const branch = await BranchesService.resolveHeader(
        organizationId,
        headers.get(BRANCH_HEADER),
      );
      return {
        user: session.user,
        session: session.session,
        actor: {
          userId: session.user.id,
          organizationId,
          branchId: branch.branchId,
          branchUuid: branch.branchUuid,
        },
      };
    },
  },
});
