# Changelog

## Rectified project — 10 November 2026

- Aligned the concept vector order with the mid-review: Arrays, Loops, Recursion, Sorting.
- Replaced generic/incorrect starter question data with 30 topic- and difficulty-labelled programming questions and 94 test cases.
- Implemented Python test-case evaluation using the browser Pyodide runtime.
- Implemented the mid-review performance formula: correctness 60%, time 25%, difficulty contribution 15% of correctness × difficulty weight.
- Recalculated concept skill scores as mean performance scores and derived learning need with `N = 1 - S`.
- Corrected recommendation similarity to compare learning need `N` with each question vector `Q`.
- Implemented concept-specific target difficulty and the 70% similarity + 30% difficulty-match ranking score.
- Added balanced easy-question recommendations for learners with no attempt history.
- Added an explanation page, attempt history, JSON export, responsive layout and documentation.
- Added data and mathematical regression tests.

## PPT-aligned automatic recommendation and timer update — 11 November 2026

- Added a question stopwatch that starts when Practice is opened, pauses while the learner navigates to another page, resumes the same attempt, and stops immediately when Submit is pressed.
- Prevented duplicate timer intervals and blocked question navigation while an evaluation is in progress.
- Added an automatic top-ranked unfinished-question card beneath each submission result, including calculated similarity, difficulty-match and final scores plus an explanation.
- Added a direct action to open the recommended question in the practice editor.
- Kept the Recommendations page and its top-eight unfinished-question ranking.
- Preserved the neutral cold-start profile and balanced easy-question sequence across all four concepts.
- Removed the How it works navigation item and webpage section as requested.
- Added JavaScript regression tests for scoring, learner-specific rankings, completed-question exclusion, cold start and timer behaviour.
