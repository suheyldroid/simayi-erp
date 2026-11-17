import type { TenantActor } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { runWithTransaction } from "@better-auth/core/context";
import { APIError } from "better-auth/api";
import { defaultRoles } from "better-auth/plugins/organization/access";
import createError from "http-errors";
import { auth } from "../auth/auth";
import { MediaFilesService } from "../media/service";
import { UsersFormatter } from "./formatter";
import type { UsersModel, UsersUpdate } from "./model";

type NativeOrganizationRole = keyof typeof defaultRoles;

const nativeOrganizationRoles = new Set<string>(Object.keys(defaultRoles));

function isNativeOrganizationRole(
  role: string,
): role is NativeOrganizationRole {
  return nativeOrganizationRoles.has(role);
}

function parseRoleNames(
  role: string | readonly string[],
): NativeOrganizationRole[] {
  const source = typeof role === "string" ? [role] : role;
  const names = source
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (names.length === 0 || names.length > 32)
    throw new createError.BadRequest("Role is required");
  if (names.some((name) => name.length > 128))
    throw new createError.BadRequest("Role name is too long");
  if (new Set(names).size !== names.length)
    throw new createError.BadRequest("Duplicate role");
  const roles = names.filter(isNativeOrganizationRole);
  if (roles.length !== names.length)
    throw new createError.BadRequest("Unknown organization role");
  return roles;
}

export abstract class UsersService {
  static isAdministrator(role: string | null | undefined): boolean {
    return role?.split(",").includes("admin") ?? false;
  }

  static requireAdministrator(role: string | null | undefined): void {
    if (!UsersService.isAdministrator(role))
      throw new createError.Forbidden("Administrator access required");
  }

  static async index(
    query: UsersModel["listQuery"],
    actor: TenantActor,
  ): Promise<UsersModel["listResponse"]> {
    const members = await prisma.member.findMany({
      where: { organizationId: actor.organizationId },
      select: { userId: true },
    });
    const where = {
      id: { in: members.map((member) => member.userId) },
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: "insensitive" as const },
              },
              {
                email: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.user.count({ where }),
    ]);
    return {
      users: users.map(UsersFormatter.toUser),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  static async get(
    id: string,
    actor: TenantActor,
  ): Promise<UsersModel["user"]> {
    return UsersService.findInOrganization(id, actor.organizationId);
  }

  private static async find(id: string): Promise<UsersModel["user"]> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new createError.NotFound("User not found");
    return UsersFormatter.toUser(user);
  }

  private static async findInOrganization(
    id: string,
    organizationId: string,
  ): Promise<UsersModel["user"]> {
    const member = await prisma.member.findFirst({
      where: { userId: id, organizationId },
      select: { id: true },
    });
    if (!member) throw new createError.NotFound("User not found");
    return UsersService.find(id);
  }

  static async updateProfile(
    id: string,
    body: UsersModel["profileBody"],
    headers: Headers,
  ): Promise<UsersModel["user"]> {
    // The target is known here even if a future adapter stops exposing the
    // admin body to the database hook; reject foreign/new URL references before
    // the native write. The hook and trigger still enforce the same rules.
    if (body.image !== undefined)
      await MediaFilesService.assertAvatarUpdate({
        targetId: id,
        image: body.image,
      });
    const data: UsersUpdate = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.image !== undefined) data.image = body.image;
    return UsersService.updateUser(id, data, headers);
  }

  static async setStatus(
    id: string,
    body: UsersModel["statusBody"],
    headers: Headers,
  ): Promise<UsersModel["user"]> {
    const user = await UsersService.find(id);
    // Keep administrator accounts available; role/recovery management is outside this module.
    if (!body.isActive && user.role?.split(",").includes("admin"))
      throw new createError.Conflict(
        "Administrator accounts cannot be deactivated here",
      );
    return UsersService.updateUser(
      id,
      {
        isActive: body.isActive,
        banned: !body.isActive,
        banReason: body.isActive
          ? null
          : "Account deactivated by an administrator",
        banExpires: null,
      },
      headers,
    );
  }

  static async addMember(
    actor: TenantActor,
    body: UsersModel["memberBody"],
    headers: Headers,
  ): Promise<UsersModel["member"]> {
    const roleNames = parseRoleNames(body.role);
    try {
      const { adapter } = await auth.$context;
      const member = await runWithTransaction(adapter, async () => {
        await UsersService.assertMemberManagement(actor, roleNames, headers);
        return auth.api.addMember({
          headers,
          body: {
            userId: body.userId,
            role: roleNames,
            organizationId: actor.organizationId,
          },
        });
      });
      return UsersFormatter.toMember(member);
    } catch (error) {
      if (error instanceof APIError)
        throw createError(error.statusCode, error.message);
      throw error;
    }
  }

  static async updateMemberRole(
    actor: TenantActor,
    memberId: string,
    body: UsersModel["memberRoleBody"],
    headers: Headers,
  ): Promise<UsersModel["member"]> {
    const roleNames = parseRoleNames(body.role);
    const existing = await prisma.member.findFirst({
      where: { id: memberId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!existing) throw new createError.NotFound("Member not found");
    try {
      const { adapter } = await auth.$context;
      const member = await runWithTransaction(adapter, () =>
        auth.api.updateMemberRole({
          headers,
          body: {
            memberId,
            organizationId: actor.organizationId,
            role: roleNames,
          },
        }),
      );
      return UsersFormatter.toMember(member);
    } catch (error) {
      if (error instanceof APIError)
        throw createError(error.statusCode, error.message);
      throw error;
    }
  }

  /**
   * Better Auth's addMember API is server-only and skips member authorization,
   * so the public wrapper applies the native organization rules itself: the
   * native member:create permission plus the creator-role constraint for owner.
   */
  private static async assertMemberManagement(
    actor: TenantActor,
    roleNames: readonly string[],
    headers: Headers,
  ): Promise<void> {
    const membership = await prisma.member.findFirst({
      where: {
        userId: actor.userId,
        organizationId: actor.organizationId,
      },
      select: { role: true },
    });
    if (!membership)
      throw new createError.Forbidden("Organization membership required");
    const actorRoles = membership.role.split(",").map((role) => role.trim());
    if (roleNames.includes("owner") && !actorRoles.includes("owner"))
      throw new createError.Forbidden(
        "Only an organization owner can assign the owner role",
      );
    const { success } = await auth.api.hasPermission({
      headers,
      body: {
        organizationId: actor.organizationId,
        permissions: { member: ["create"] },
      },
    });
    if (!success)
      throw new createError.Forbidden(
        "Organization member permission required",
      );
  }

  private static async updateUser(
    id: string,
    data: UsersUpdate,
    headers: Headers,
  ): Promise<UsersModel["user"]> {
    try {
      const { adapter } = await auth.$context;
      // Better Auth revokes sessions when banned=true; keep it atomic with the status change.
      await runWithTransaction(adapter, () =>
        auth.api.adminUpdateUser({ headers, body: { userId: id, data } }),
      );
    } catch (error) {
      if (error instanceof APIError)
        throw createError(error.statusCode, error.message);
      throw error;
    }
    return UsersService.find(id);
  }
}
