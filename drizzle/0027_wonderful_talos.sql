CREATE TABLE "inmueble_adjunto" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"registro_id" text NOT NULL,
	"nombre" text NOT NULL,
	"mime" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inmueble_historial" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"registro_id" text NOT NULL,
	"usuario_id" text NOT NULL,
	"anterior" jsonb,
	"nuevo" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inmueble_registro" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"tipo" text NOT NULL,
	"codigo" text,
	"datos" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inmueble_adjunto" ADD CONSTRAINT "inmueble_adjunto_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inmueble_adjunto" ADD CONSTRAINT "inmueble_adjunto_registro_id_inmueble_registro_id_fk" FOREIGN KEY ("registro_id") REFERENCES "public"."inmueble_registro"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inmueble_historial" ADD CONSTRAINT "inmueble_historial_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inmueble_historial" ADD CONSTRAINT "inmueble_historial_registro_id_inmueble_registro_id_fk" FOREIGN KEY ("registro_id") REFERENCES "public"."inmueble_registro"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inmueble_registro" ADD CONSTRAINT "inmueble_registro_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inmueble_adjunto_org_registro_idx" ON "inmueble_adjunto" USING btree ("organization_id","registro_id");--> statement-breakpoint
CREATE INDEX "inmueble_historial_org_registro_idx" ON "inmueble_historial" USING btree ("organization_id","registro_id");--> statement-breakpoint
CREATE INDEX "inmueble_registro_org_tipo_idx" ON "inmueble_registro" USING btree ("organization_id","tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "inmueble_registro_org_codigo_idx" ON "inmueble_registro" USING btree ("organization_id","codigo");