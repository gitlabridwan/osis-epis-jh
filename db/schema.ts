import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const ledgers = sqliteTable("kas_ledgers", {
  id: text("id").primaryKey(), ownerUserId: text("owner_user_id").notNull(),
  payload: text("payload").notNull(), revision: integer("revision").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const users = sqliteTable("kas_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("kas_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("kas_sessions_user_idx").on(table.userId), index("kas_sessions_expiry_idx").on(table.expiresAt)]);

export const authLimits = sqliteTable("kas_auth_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull(),
  resetAt: integer("reset_at").notNull(),
}, (table) => [index("kas_auth_limits_reset_idx").on(table.resetAt)]);
