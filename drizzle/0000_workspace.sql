CREATE TABLE brands (owner TEXT NOT NULL, id TEXT NOT NULL, profile TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1, created TEXT NOT NULL, PRIMARY KEY(owner,id));
--> statement-breakpoint
CREATE TABLE records (owner TEXT NOT NULL, brand TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL, PRIMARY KEY(owner,brand,id), FOREIGN KEY(owner,brand) REFERENCES brands(owner,id) ON DELETE CASCADE);
--> statement-breakpoint
CREATE INDEX records_kind ON records(owner,brand,kind,updated DESC);
--> statement-breakpoint
CREATE TABLE preferences (owner TEXT PRIMARY KEY, sealed_key TEXT, model TEXT);
--> statement-breakpoint
CREATE TABLE quotas (owner TEXT NOT NULL, bucket TEXT NOT NULL, window INTEGER NOT NULL, calls INTEGER NOT NULL, PRIMARY KEY(owner,bucket));
