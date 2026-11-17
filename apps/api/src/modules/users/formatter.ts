import type { UsersMemberRecord, UsersModel, UsersRecord } from "./model";

export abstract class UsersFormatter {
  static toUser(user: UsersRecord): UsersModel["user"] {
    return {
      ...user,
      banExpires: user.banExpires ? user.banExpires.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  static toMember(member: UsersMemberRecord): UsersModel["member"] {
    return {
      ...member,
      role: Array.isArray(member.role) ? member.role.join(",") : member.role,
      createdAt:
        member.createdAt instanceof Date
          ? member.createdAt.toISOString()
          : new Date(member.createdAt).toISOString(),
    };
  }
}
