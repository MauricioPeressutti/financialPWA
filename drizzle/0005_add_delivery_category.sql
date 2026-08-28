-- Categoría "Delivery" (gasto) + subcategorías para todos los equipos que aún no la tengan.
WITH new_cat AS (
  INSERT INTO "categories" ("team_id", "name", "kind")
  SELECT t."id", 'Delivery', 'expense'
  FROM "teams" t
  WHERE NOT EXISTS (
    SELECT 1 FROM "categories" c
    WHERE c."team_id" = t."id"
      AND lower(c."name") = 'delivery'
      AND c."kind" = 'expense'
  )
  RETURNING "id", "team_id"
)
INSERT INTO "subcategories" ("team_id", "category_id", "name")
SELECT nc."team_id", nc."id", s."name"
FROM new_cat nc
CROSS JOIN (VALUES ('Rappi'), ('PedidosYa'), ('Uber Eats'), ('Otro')) AS s("name");
