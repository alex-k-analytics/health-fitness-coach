# Agents

## Summary

Health & Fitness Coach does not use a broad multi-agent orchestration architecture today. Its active AI behavior is concentrated in one production nutrition-analysis pipeline, alongside a small set of stubbed coaching and integration services.

The clean way to think about the app is:

1. one real nutrition-analysis agent flow
2. several lightweight or placeholder coaching services
3. deterministic application logic around both

## Active Production Agent Flow

### Nutrition Analysis Agent

The main real AI system in this app is the nutrition analysis service.

Its job is to convert a meal log into structured nutrition estimates using:

- meal title
- serving details
- user goals
- recent health context
- optional saved-food reference
- uploaded plate photos
- uploaded nutrition label photos
- uploaded other supporting images

Outputs include:

- analysis status
- summary
- confidence score
- estimated calories
- protein, carbs, fat
- fiber, sugar, sodium
- micronutrients
- vitamins
- explicit assumptions
- per-item food breakdown
- raw analysis payload

This is a structured-output agent, not a chat assistant. It is optimized to return normalized JSON that the backend can persist directly into the meal record.

Primary module:

- `backend/src/services/nutritionAnalysisService.ts`

## Nutrition Agent Pipeline

The nutrition agent flow is wrapped by deterministic backend logic.

High-level pipeline:

1. Accept multipart meal submission with images and serving context
2. Create or prepare the meal record
3. Resolve any referenced saved food
4. Build prompt context from goals, health data, and meal metadata
5. Send structured analysis request to OpenAI
6. Normalize returned values
7. Persist meal analysis and image metadata
8. Optionally create a reusable saved food from the result

The backend owns orchestration, validation, persistence, and file storage. The model is only used for nutrition inference.

## Fallback Modes

The nutrition system is explicitly hybrid and fault-tolerant.

If live OpenAI analysis is unavailable, it falls back in this order:

1. saved-food scaling fallback
2. generic heuristic calorie and macro estimate

This means the app can still save meals and provide usable numbers even without a working AI call.

## Stubbed or Partial Agent-Like Services

### Workout Planning Service

`backend/src/services/agentService.ts` contains lightweight coaching-style methods for:

- generating a workout plan
- estimating food portion guidance from calorie balance
- generating a diet-balance recommendation

These are currently simple rule-based or hardcoded service methods rather than mature LLM-backed agents.

### Calendar Integration Service

`backend/src/services/googleCalendarService.ts` exists as a placeholder integration service for workout scheduling. It is not a fully implemented production workflow.

### SMS Reminder Service

`backend/src/services/smsService.ts` exists as a Twilio-compatible stub for future reminder or messaging workflows.

## Workout “Agent” Reality

The workout area is mostly deterministic today.

What is real:

- structured workout session logging
- exercise-level data entry
- calorie recomputation from workout details
- weekly summaries in the frontend

What is not yet a mature agent system:

- personalized workout coaching
- automated programming
- real scheduling automation
- active conversational coaching

## Architectural Interpretation

If you need a precise architecture label, this app is best described as:

- a standard fullstack health-tracking app
- with one production AI analysis pipeline
- plus some future-oriented coaching and integration stubs

It is not currently a dual-agent or multi-agent platform.

## Practical View

The simplest mental model is:

1. User logs a meal with text and images
2. Backend sends structured context to OpenAI
3. Model returns nutrition estimates
4. Backend normalizes and stores the results
5. Dashboard and meal history surface those results

Everything else in the app currently behaves more like conventional product logic than agent orchestration.
