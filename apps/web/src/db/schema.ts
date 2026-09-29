import { createId } from '@paralleldrive/cuid2'
import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  integer,
} from 'drizzle-orm/pg-core'
import type { PgSchema } from 'drizzle-orm/pg-core'

export function getSchemaName(url?: string) {
  try {
    return (
      new URL(url ?? process.env.DATABASE_URL ?? '').searchParams.get(
        'schema',
      ) ?? 'public'
    )
  } catch {
    return 'public'
  }
}

// unified schema - extracted from DATABASE_URL ?schema= param (like Prisma did)
// falls back to 'public'; drizzle-kit generate reads .env at generation time
//
// drizzle throws if you pass 'public' to pgSchema() ("Postgres is using public
// schema by default"), so when no explicit schema is configured we use the
// schema-less pgTable/pgEnum builders instead. Same tables, same DDL, no
// migration required — it just makes the documented 'public' fallback work.
const schemaName = getSchemaName()

export const appSchema = (
  schemaName === 'public'
    ? { table: pgTable, enum: pgEnum }
    : pgSchema(schemaName)
) as PgSchema
// keep alias for backward compat during migration
export const testSchema = appSchema

// keep unified - single source for all tables

export const subscriptionStatusEnum = appSchema.enum('SubscriptionStatus', [
  'active',
  'cancelled',
  'expired',
  'on_hold',
])

export const user = appSchema.table('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const session = appSchema.table(
  'session',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    expiresAt: timestamp('expiresAt').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_userId_idx').on(t.userId)],
)

export const account = appSchema.table(
  'account',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('account_userId_idx').on(t.userId)],
)

export const verification = appSchema.table(
  'verification',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expiresAt').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

export const subscription = appSchema.table(
  'subscription',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    dodoSubscriptionId: text('dodoSubscriptionId').notNull().unique(),
    dodoCustomerId: text('dodoCustomerId'),
    productId: text('productId').notNull(),
    status: subscriptionStatusEnum('status').notNull().default('active'),
    planId: text('planId').notNull().default('starter'),
    billingInterval: text('billingInterval').notNull().default('monthly'),
    currentPeriodEnd: timestamp('currentPeriodEnd'),
    cancelAtNextBilling: boolean('cancelAtNextBilling')
      .notNull()
      .default(false),
    trialEndsAt: timestamp('trialEndsAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('subscription_userId_idx').on(t.userId)],
)

export const todo = appSchema.table('Todo', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  title: text('title').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// relations - keeps drizzle query includes unified
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  subscriptions: many(subscription),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  user: one(user, { fields: [subscription.userId], references: [user.id] }),
}))
