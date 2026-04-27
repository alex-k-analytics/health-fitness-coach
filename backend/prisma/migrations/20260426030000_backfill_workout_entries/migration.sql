INSERT INTO "WorkoutSession" (
    "id",
    "accountId",
    "activityType",
    "title",
    "status",
    "performedAt",
    "endTime",
    "totalCalories",
    "categoryCalories",
    "createdAt",
    "updatedAt"
)
SELECT
    e."id",
    e."accountId",
    'OTHER'::"WorkoutActivityType",
    e."title",
    'COMPLETED'::"WorkoutSessionStatus",
    e."performedAt",
    e."performedAt",
    e."caloriesBurned",
    jsonb_build_object('OTHER', e."caloriesBurned"),
    e."createdAt",
    e."updatedAt"
FROM "WorkoutEntry" e
ON CONFLICT ("id") DO NOTHING;
