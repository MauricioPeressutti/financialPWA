-- Categorías de gasto "Farmacia online" y "Kiosco" para todos los equipos que aún no las tengan.
INSERT INTO "categories" ("team_id", "name", "kind")
SELECT t."id", n."name", 'expense'
FROM "teams" t
CROSS JOIN (VALUES ('Farmacia online'), ('Kiosco')) AS n("name")
WHERE NOT EXISTS (
  SELECT 1 FROM "categories" c
  WHERE c."team_id" = t."id"
    AND lower(c."name") = lower(n."name")
    AND c."kind" = 'expense'
);
