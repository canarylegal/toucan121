-- Normalize legacy free-text actionPoints into JSON checklist items
UPDATE "Booking"
SET "actionPoints" = CASE
  WHEN trim("actionPoints") = '' THEN '[]'
  WHEN left(trim("actionPoints"), 1) = '[' THEN "actionPoints"
  ELSE json_build_array(
    json_build_object(
      'id', 'legacy-0',
      'text', "actionPoints",
      'done', "actionPointsDone"
    )
  )::text
END;

ALTER TABLE "Booking" ALTER COLUMN "actionPoints" SET DEFAULT '[]';
