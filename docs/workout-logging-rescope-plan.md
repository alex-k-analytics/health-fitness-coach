# Workout Logging Rescope Plan

## Summary

Redesign workout logging so the primary unit is a mixed training session, not a single workout type. A session can contain ordered strength, cardio, HIIT, and other blocks. Strength logging should prioritize exercises, full set sequences, reps, weight, and previous performance; duration remains optional and secondary. Repeating past workouts becomes a core workflow by cloning prior sessions into an editable plan and showing full comparable set history while logging.

## Key Changes

- Replace the current type-first modal flow with a session builder:
  - Entry options: `Start workout`, `Log completed workout`, and `Repeat recent`.
  - Session contains ordered exercise blocks; users can add strength and cardio inline in the same workout.
  - Workout type becomes a derived display label: show `Mixed` when exercises span multiple categories; keep backend `activityType` as the first/primary exercise category for compatibility.
- Make strength live logging set-focused:
  - During a workout, show each strength exercise with editable set rows.
  - Beside the current set rows, show the full ordered set sequence from the comparable prior workout for that exercise, not just a max or single previous set.
  - Preserve prior set order because warmups, working sets, top sets, PR attempts, and warm-down sets are all relevant to judging progress.
  - Add quick actions: copy previous set, copy all previous sets, add set, remove set, reorder exercises.
  - Keep elapsed duration available but visually secondary and not required for strength-only sessions.
- Make cardio an inline block:
  - Add cardio exercises from the same builder, including duration and distance fields.
  - For cardio-only sessions, timer/duration remains primary.
  - For strength plus cardio, save one session with both exercise types and category calorie breakdown.
- Add repeat/comparison support:
  - Recent workout cards get separate `Repeat` and `Edit` actions.
  - `Repeat` opens a new unsaved session cloned from the selected session, preserving exercises and full set structures.
  - For each exercise, comparison defaults to the latest prior completed session containing that exercise, showing all sets in order.
  - If the workout was cloned, use the cloned workout as the comparison source for exercises it contains; otherwise fall back to latest prior exercise history.
- Keep quick logging but rename and simplify it:
  - `Log completed workout` remains for after-the-fact entry.
  - It uses the same mixed session builder with manual duration enabled and no live timer emphasis.
  - Existing simple `/workouts` compatibility endpoints can remain, but new UI should use session endpoints.

## Public APIs / Types

- Keep existing `WorkoutSession` and `WorkoutExercise` schema; no Prisma migration required for this rescope.
- Add a backend read endpoint for comparison data, for example `GET /workouts/exercise-history?names=Bench%20Press,Squat`, returning the latest prior completed occurrence per exercise with its full ordered sets or cardio metrics.
- Keep `POST /workouts/sessions` and `PATCH /workouts/sessions/:id` as the save/update paths.
- Add frontend draft types for session-builder state, including cloned session source metadata and per-exercise comparison data.
- Derive `Mixed` presentation on the frontend from exercise categories rather than adding a new enum value.

## Test Plan

- Backend:
  - Typecheck.
  - Validate exercise-history filters by account and returns full ordered set sequences from the latest comparable prior exercise.
  - Verify mixed sessions save with both lift and cardio exercises and recomputed calories.
- Frontend:
  - Typecheck and production build.
  - Add or update Playwright UX coverage for:
    - start a strength session, view prior full set sequence, enter current sets, save;
    - repeat a prior workout, clone all exercises/sets, edit weights, save as new session;
    - add cardio after strength in the same session;
    - log a completed mixed workout without using the timer;
    - edit an existing session without creating a duplicate.
- Manual UX checks:
  - Mobile width can edit set rows and view previous set sequences without horizontal overflow.
  - Recent cards clearly distinguish `Repeat` from `Edit`.
  - Strength-only sessions do not make duration feel mandatory.
  - Mixed session cards show strength volume and cardio distance/duration clearly.

## Assumptions

- No schema migration is needed for the first implementation because the existing session/exercise model already supports mixed workouts.
- Strength duration should be retained for history/calorie context, but not treated as the main strength metric.
- Previous comparison means the latest completed prior occurrence for that exercise, including all sets in original order.
- Personal records, saved named templates, supersets, rest timers, RPE, and plate calculators are out of scope for this first rescope unless added later.
