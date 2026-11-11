# Project Documentation

## 1. Objective

Build a personalised programming practice prototype that measures attempts, represents student performance as concept-wise skill vectors, compares learning needs with question vectors, and ranks suitable next questions.

## 2. Concept model

The fixed vector order is **Arrays, Loops, Recursion, Sorting**. Each question stores a four-dimensional `requiredSkillVector`. The current bank uses one-hot concept vectors; the recommendation function can also handle weighted multi-concept vectors.

## 3. Data model

Each browser-stored learner profile contains:

- Student ID and display name.
- Four-element skill vector.
- Chronological attempt history.
- IDs of submitted/completed questions.
- Creation and last-activity timestamps.

Each attempt records the question, concept, difficulty, elapsed time, test cases passed, correctness, time score, difficulty weight and final performance score.

## 4. Mathematical implementation

### Performance

`C = passed / total`, `T = max(0, 1 - elapsed / timeLimit)`, and `D ∈ {0.50, 0.75, 1.00}` for Easy, Medium and Hard.

`P = 100 × [0.60C + 0.25T + 0.15(C × D)]`.

### Skill and need

For each concept, `Sₖ = mean(P) / 100`. Concepts without an attempt use a neutral starting estimate of `0.50`. `N = 1 - S`.

### Similarity

`cos(N,Q) = (N · Q) / (||N|| × ||Q||)`. The implementation returns zero if either vector has zero magnitude.

### Difficulty match

A concept's target level is Easy when skill is below 0.50, Medium from 0.50 to below 0.75, and Hard at 0.75 or above. Exact match = 1.0, adjacent level = 0.5, and a two-level gap = 0.0. For a multi-concept question, the match is weighted by its question vector.

### Final ranking

`Recommendation = 0.70 × cosine similarity + 0.30 × difficulty match`.

Completed questions are excluded. A learner with no attempt history receives a balanced easy starter set across all concepts.

## 5. Implementation flow

1. Learner selects a question and writes a Python solution.
2. Run executes the code with sample or custom input.
3. Submit executes the solution against the question's stored test cases.
4. Correctness, elapsed time and question difficulty are used to calculate performance score.
5. The concept skill score is recalculated from the mean performance of all attempts in that concept.
6. Learning need is calculated as `N = 1 - S`.
7. Cosine similarity and difficulty match are combined to rank uncompleted questions.
8. Profile and history are saved in browser LocalStorage; the learner can export a JSON backup.

## 6. Scope and limitations

This is a browser-based educational prototype. Pyodide provides Python execution and the included question bank provides test cases. The runtime is downloaded from a CDN and requires an internet connection on first load. The app is not a secure production code judge and does not provide a hard execution timeout. C compilation, server-side storage, recency-weighted skill scores and empirical validation of the weights are outside the current implementation scope.

The score formula matches the mid-review, including its documented limitation that the time term can contribute when correctness is zero. Gating the time term by correctness is identified as future refinement rather than silently changing the reviewed formula.
