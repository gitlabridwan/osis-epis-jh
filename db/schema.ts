import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const ledgers = sqliteTable("kas_ledgers", {
  id: text("id").primaryKey(), ownerUserId: text("owner_user_id").notNull(),
  payload: text("payload").notNull(), revision: integer("revision").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
