import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  check,
} from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    publicToken: text("public_token").notNull().unique(),
    reviewHash: text("review_hash").notNull().unique(),
    isOpen: integer("is_open").notNull().default(1),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    check("title_length", sql`length(${t.title}) BETWEEN 1 AND 100`),
    check("open_boolean", sql`${t.isOpen} IN (0,1)`),
  ],
);
export const feedback = sqliteTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    comment: text("comment").notNull(),
    rating: integer("rating"),
    receipt: text("receipt").notNull().unique(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("feedback_session_idx").on(t.sessionId),
    check("comment_length", sql`length(${t.comment}) BETWEEN 2 AND 2000`),
    check("rating_range", sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);
export const reviews = sqliteTable(
  "reviews",
  {
    feedbackId: text("feedback_id")
      .primaryKey()
      .references(() => feedback.id),
    label: text("label").notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    check(
      "review_label",
      sql`${t.label} IN ('positive','negative','neutral','mixed')`,
    ),
  ],
);
export const reviewHistory = sqliteTable(
  "review_history",
  {
    id: text("id").primaryKey(),
    feedbackId: text("feedback_id")
      .notNull()
      .references(() => feedback.id),
    label: text("label").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("history_feedback_idx").on(t.feedbackId),
    check(
      "history_label",
      sql`${t.label} IN ('positive','negative','neutral','mixed')`,
    ),
  ],
);
export const predictions = sqliteTable(
  "predictions",
  {
    feedbackId: text("feedback_id")
      .notNull()
      .references(() => feedback.id),
    modelVersion: text("model_version").notNull(),
    label: text("label").notNull(),
    probability: real("probability").notNull(),
  },
  (t) => [
    index("prediction_feedback_idx").on(t.feedbackId),
    check(
      "prediction_label",
      sql`${t.label} IN ('positive','negative','neutral','mixed','unreviewed')`,
    ),
  ],
);
