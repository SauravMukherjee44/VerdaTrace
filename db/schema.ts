import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const apiRateLimits = sqliteTable(
  "api_rate_limits",
  {
    clientHash: text("client_hash").notNull(),
    windowStart: integer("window_start").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.clientHash, table.windowStart] }),
    index("api_rate_limits_updated_idx").on(table.updatedAt),
  ],
);

export const contactInquiries = sqliteTable(
  "contact_inquiries",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    workEmail: text("work_email").notNull(),
    organization: text("organization").notNull(),
    role: text("role").notNull(),
    inquiryType: text("inquiry_type").notNull(),
    message: text("message").notNull(),
    createdAt: integer("created_at").notNull(),
    status: text("status").notNull().default("new"),
  },
  (table) => [
    index("contact_inquiries_created_idx").on(table.createdAt),
    index("contact_inquiries_status_idx").on(table.status),
  ],
);
