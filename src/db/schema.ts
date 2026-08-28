import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ─────────────────────────────────────────────
export const paymentMethod = pgEnum("payment_method", [
  "efectivo",
  "debito",
  "credito",
  "modo_debito",
  "modo_credito",
  "mercadopago",
]);

export const incomeMethod = pgEnum("income_method", [
  "efectivo",
  "transferencia",
  "mercadopago",
  "cheque",
  "otro",
]);

export const categoryKind = pgEnum("category_kind", ["expense", "income"]);

export const splitMode = pgEnum("split_mode", [
  "none",
  "proportional",
  "even",
  "custom",
]);

export const memberRole = pgEnum("member_role", ["owner", "member"]);

export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

// ─── Usuarios (espejo de Firebase Auth) ────────────────
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  firebaseUid: text("firebase_uid").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Vínculo con Telegram ──────────────────────────────
export const telegramLinks = pgTable("telegram_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  telegramUserId: text("telegram_user_id").unique(),
  telegramChatId: text("telegram_chat_id"),
  linkedAt: timestamp("linked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Movimientos pendientes de confirmar (bot: gasto o ingreso?) ──
export const pendingMovements = pgTable("pending_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Equipos ───────────────────────────────────────────
export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id),
  primaryCurrency: text("primary_currency").notNull().default("ARS"),
  currencies: jsonb("currencies")
    .notNull()
    .$type<string[]>()
    .default(["ARS", "USD"]),
  fxReference: text("fx_reference").notNull().default("blue"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Cotizaciones (cache diario) ───────────────────────
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    day: date("day").notNull(),
    base: text("base").notNull(), // p.ej. "USD"
    quote: text("quote").notNull(), // p.ej. "ARS"
    reference: text("reference").notNull().default("blue"),
    rate: doublePrecision("rate").notNull(), // 1 base = rate quote
    source: text("source").notNull().default("dolarapi"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("exchange_rates_day_pair_idx").on(
      t.day,
      t.base,
      t.quote,
      t.reference,
    ),
  ],
);

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("member"),
    // Calculadora de esfuerzo: ingreso mensual declarado por la persona.
    declaredIncomeCents: integer("declared_income_cents").notNull().default(0),
    declaredIncomeCurrency: text("declared_income_currency")
      .notNull()
      .default("ARS"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.userId] })],
);

export const teamInvitations = pgTable("team_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  email: text("email"), // null = link abierto
  token: text("token").notNull().unique(),
  role: memberRole("role").notNull().default("member"),
  invitedByUserId: uuid("invited_by_user_id")
    .notNull()
    .references(() => users.id),
  status: invitationStatus("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Categorías ────────────────────────────────────────
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: categoryKind("kind").notNull().default("expense"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const subcategories = pgTable("subcategories", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Gastos ────────────────────────────────────────────
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("ARS"),
    fxRate: doublePrecision("fx_rate").notNull().default(1), // 1 currency = fxRate moneda principal
    baseAmountCents: integer("base_amount_cents").notNull().default(0), // equivalente en moneda principal
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    subcategoryId: uuid("subcategory_id").references(() => subcategories.id),
    paymentMethod: paymentMethod("payment_method").notNull(),
    description: text("description"),
    spentOn: date("spent_on").notNull(),
    // Calculadora de esfuerzo
    splitMode: splitMode("split_mode").notNull().default("none"),
    paidByUserId: uuid("paid_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("expenses_team_spent_idx").on(t.teamId, t.spentOn),
    index("expenses_team_category_idx").on(t.teamId, t.categoryId),
  ],
);

// ─── Reparto de gastos compartidos ─────────────────────
export const expenseSplits = pgTable(
  "expense_splits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    owedCents: integer("owed_cents").notNull(), // en la moneda del gasto
  },
  (t) => [uniqueIndex("expense_splits_expense_user_idx").on(t.expenseId, t.userId)],
);

// ─── Saldos entre personas (settle up) ─────────────────
export const settlements = pgTable("settlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  fromUserId: uuid("from_user_id")
    .notNull()
    .references(() => users.id),
  toUserId: uuid("to_user_id")
    .notNull()
    .references(() => users.id),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("ARS"),
  note: text("note"),
  settledOn: date("settled_on").notNull(),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Ingresos ──────────────────────────────────────────
export const incomes = pgTable(
  "incomes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("ARS"),
    fxRate: doublePrecision("fx_rate").notNull().default(1),
    baseAmountCents: integer("base_amount_cents").notNull().default(0),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    subcategoryId: uuid("subcategory_id").references(() => subcategories.id),
    method: incomeMethod("method").notNull().default("transferencia"),
    description: text("description"),
    receivedOn: date("received_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("incomes_team_received_idx").on(t.teamId, t.receivedOn),
    index("incomes_team_category_idx").on(t.teamId, t.categoryId),
  ],
);

// ─── Reintegros ────────────────────────────────────────
export const reimbursements = pgTable(
  "reimbursements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("ARS"),
    fxRate: doublePrecision("fx_rate").notNull().default(1),
    baseAmountCents: integer("base_amount_cents").notNull().default(0),
    note: text("note"),
    reimbursedOn: date("reimbursed_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("reimbursements_expense_idx").on(t.expenseId)],
);

// ─── Tipos ─────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Subcategory = typeof subcategories.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Income = typeof incomes.$inferSelect;
export type Reimbursement = typeof reimbursements.$inferSelect;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type SplitMode = (typeof splitMode.enumValues)[number];
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
export type IncomeMethod = (typeof incomeMethod.enumValues)[number];
export type CategoryKind = (typeof categoryKind.enumValues)[number];
