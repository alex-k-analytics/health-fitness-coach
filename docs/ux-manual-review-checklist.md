# UX Manual Review Checklist

Use this checklist after `npm run ux:audit` passes. The automated audit catches structural regressions; this pass covers judgment-heavy details.

## Visual Hierarchy

- Primary action is visually strongest on each page.
- Secondary and destructive actions are separated clearly.
- Headings, body copy, labels, and helper text use appropriate scale for their containers.
- Cards and panels do not feel nested or visually crowded.
- Charts and progress states are readable without inspecting tiny labels.

## Content Clarity

- Empty states explain what happened and what the user can do next.
- Blocked states name the missing requirement and provide a clear next action.
- Success and error messages describe the result in user language.
- Health, nutrition, and workout copy avoids ambiguity around units and saved values.
- Repeated labels mean the same thing across Dashboard, Meals, Workouts, Planning, and Settings.
- Toasts/global banners should not push sticky navigation down, create page jump, or add scrollbars to header/bottom navigation.

## Interaction Quality

- Pointer and keyboard flows feel equivalent for core actions.
- Hover, focus, disabled, loading, and saved states are visible but not distracting.
- Dialogs and drawers feel like short tasks, not dead ends.
- Long forms keep the save action discoverable.
- Closing a surface does not surprise the user or discard changes silently.
- Feedback toasts are dismissible/disappearable and do not obscure primary actions for long-running workflows.

## Workout Logging Review

- Recent workout cards make `Repeat` and `Edit` feel distinct and hard to confuse.
- Repeating a workout opens a new unsaved session with prior exercises and full set sequences visible.
- Strength rows show current reps/weight and prior full-set context clearly enough to judge warmups, working sets, top sets, and warm-downs.
- `Copy all` and per-set copy controls are understandable without reading documentation.
- Adding cardio after strength feels like extending the same workout, not starting a second workout.
- Strength duration reads as optional/secondary; cardio duration/distance remain prominent enough for cardio blocks.
- Editing a saved workout feels like correction, while repeating feels like today's new workout.

## Responsive Review

- Check `375x812`, `768x1024`, and `1440x900`.
- Confirm bottom navigation and sticky headers do not cover content.
- Confirm long names, long meal titles, and dense workout entries wrap cleanly.
- Confirm strength set rows, previous set summaries, and `Repeat`/`Edit` actions do not create horizontal scroll at 375px.
- Confirm touch targets remain comfortable on mobile.
- Confirm screenshot labels do not hide the evidence being reviewed.

## Accessibility Judgment

- Focus order matches the visual reading order.
- Alerts and status changes are easy to understand without color alone.
- Motion feels minimal when reduced-motion is requested.
- Icon-only actions are discoverable through accessible names and desktop tooltips.
- Manual review notes should link to `docs/ux-audit-screenshots/` evidence when useful.
