CREATE TABLE model_accounts (owner TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, sealed_key TEXT NOT NULL, PRIMARY KEY(owner,provider));
--> statement-breakpoint
CREATE INDEX records_agent_queue ON records(kind,updated) WHERE kind='run';
