CREATE TABLE "booking_history" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"booking_id" text NOT NULL,
	"actor_user_id" text,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "appointment_type" text;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "responsible_user_id" text;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "reminder_minutes" integer;--> statement-breakpoint
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_history_org_booking_idx" ON "booking_history" USING btree ("organization_id","booking_id","created_at");--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_responsible_user_id_user_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;