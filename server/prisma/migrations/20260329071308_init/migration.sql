-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'agent',
    "agent_color" TEXT NOT NULL DEFAULT '#0071e3',
    "avatar_id" INTEGER NOT NULL DEFAULT 0,
    "status_text" TEXT NOT NULL DEFAULT '',
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_seen" INTEGER,
    "allowed_views" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "offices" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "routing_tag" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT '',
    "office_color" TEXT NOT NULL DEFAULT '#0071e3',
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user_offices" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "office_id" INTEGER NOT NULL,
    CONSTRAINT "user_offices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_offices_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tickets" (
    "conversation_id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL DEFAULT 'chat',
    "status" TEXT NOT NULL DEFAULT 'open',
    "human_mode" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "customer_name" TEXT,
    "customer_email" TEXT,
    "customer_phone" TEXT,
    "vehicle" TEXT,
    "subject" TEXT,
    "close_reason" TEXT,
    "last_message" TEXT,
    "last_message_id" INTEGER NOT NULL DEFAULT 0,
    "archived_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "owner_id" INTEGER,
    "office_id" INTEGER,
    CONSTRAINT "tickets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "offices" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "messages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticket_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_email" BOOLEAN NOT NULL DEFAULT false,
    "message_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("conversation_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ticket_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticket_id" TEXT NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ticket_notes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("conversation_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_notes_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customer_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customer_email" TEXT NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "customer_notes_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "owner" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "rag_failures" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "query" TEXT NOT NULL,
    "session_type" TEXT NOT NULL DEFAULT 'unknown',
    "ts_fallback_used" BOOLEAN NOT NULL DEFAULT false,
    "ts_fallback_success" BOOLEAN NOT NULL DEFAULT false,
    "ts_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticket_id" TEXT,
    "filename" TEXT NOT NULL,
    "original_name" TEXT,
    "filepath" TEXT NOT NULL,
    "expires_at" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uploaded_files_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets" ("conversation_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "email_blocklist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pattern" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'email',
    "added_by" TEXT NOT NULL DEFAULT 'system',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "local_qa_history" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "handled_by" INTEGER,
    "handled_at" DATETIME,
    "solution_text" TEXT,
    "original_question" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "offices_name_key" ON "offices"("name");

-- CreateIndex
CREATE UNIQUE INDEX "offices_routing_tag_key" ON "offices"("routing_tag");

-- CreateIndex
CREATE UNIQUE INDEX "user_offices_user_id_office_id_key" ON "user_offices"("user_id", "office_id");

-- CreateIndex
CREATE INDEX "tickets_status_updated_at_idx" ON "tickets"("status", "updated_at");

-- CreateIndex
CREATE INDEX "tickets_owner_id_idx" ON "tickets"("owner_id");

-- CreateIndex
CREATE INDEX "tickets_office_id_idx" ON "tickets"("office_id");

-- CreateIndex
CREATE INDEX "messages_ticket_id_created_at_idx" ON "messages"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_notes_ticket_id_idx" ON "ticket_notes"("ticket_id");

-- CreateIndex
CREATE INDEX "customer_notes_customer_email_idx" ON "customer_notes"("customer_email");

-- CreateIndex
CREATE INDEX "rag_failures_created_at_idx" ON "rag_failures"("created_at");

-- CreateIndex
CREATE INDEX "uploaded_files_ticket_id_idx" ON "uploaded_files"("ticket_id");

-- CreateIndex
CREATE INDEX "uploaded_files_expires_at_idx" ON "uploaded_files"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_blocklist_pattern_key" ON "email_blocklist"("pattern");

-- CreateIndex
CREATE INDEX "email_blocklist_pattern_idx" ON "email_blocklist"("pattern");

-- CreateIndex
CREATE INDEX "local_qa_history_is_archived_idx" ON "local_qa_history"("is_archived");
