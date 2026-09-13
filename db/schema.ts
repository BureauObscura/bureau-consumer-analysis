import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const studies = sqliteTable(
  "studies",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    data: text("data").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("studies_owner_updated").on(t.owner, t.updatedAt)],
);
export const runs = sqliteTable(
  "simulation_runs",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    objectKey: text("object_key").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("runs_owner_created").on(t.owner, t.createdAt)],
);
export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    data: text("data").notNull(),
    objectKey: text("object_key"),
    mime: text("mime"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("sources_owner").on(t.owner)],
);
export const analyses = sqliteTable(
  "analyses",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    sourceId: text("source_id").notNull(),
    data: text("data").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("analyses_owner_source").on(t.owner, t.sourceId)],
);
export const analysisRequests = sqliteTable("analysis_requests", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  state: text("state").notNull(),
  data: text("data"),
  createdAt: text("created_at").notNull(),
});
