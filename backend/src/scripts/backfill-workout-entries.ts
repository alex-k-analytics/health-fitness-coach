import { prisma } from "../lib/prisma.js";

async function backfillWorkoutEntries() {
  const entries = await prisma.workoutEntry.findMany({
    select: {
      id: true,
      accountId: true,
      title: true,
      caloriesBurned: true,
      performedAt: true
    }
  });

  console.log(`Found ${entries.length} WorkoutEntry records to backfill`);

  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    const existing = await prisma.workoutSession.findFirst({
      where: {
        id: entry.id
      }
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.workoutSession.create({
      data: {
        id: entry.id,
        accountId: entry.accountId,
        activityType: "OTHER",
        title: entry.title,
        status: "COMPLETED",
        performedAt: entry.performedAt,
        endTime: entry.performedAt,
        totalCalories: entry.caloriesBurned,
        categoryCalories: { OTHER: entry.caloriesBurned }
      }
    });

    created++;
  }

  console.log(`Backfilled ${created} records, skipped ${skipped} already existing`);
  await prisma.$disconnect();
}

backfillWorkoutEntries().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
