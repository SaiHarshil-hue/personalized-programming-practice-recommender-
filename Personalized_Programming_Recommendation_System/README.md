# SkillPath — Personalised Programming Practice Recommendation System

**Course:** Mathematics for Computing–I (22MAT110)  
**Project:** Personalised Programming Practice Recommendation using Similarity-Based Ranking  
**Team:** 3

## What is included

- Student profiles saved separately in browser LocalStorage using the student ID.
- A 30-question Python practice bank covering **Arrays, Loops, Recursion and Sorting**.
- A Python editor with sample/custom input and browser-based execution through Pyodide.
- Automated evaluation against the test cases stored with each question.
- The weighted performance score from the mid-review.
- Concept-wise skill scores and a learning-need vector.
- Cosine similarity, difficulty matching and ranked recommendations.
- A balanced easy-question starter set for students with no attempt history.
- An elapsed-time stopwatch that starts on opening a practice question, pauses across page navigation, and stops at submission.
- An automatic “Your Next Recommended Question” card after every submission, with live algorithm scores and a direct button to open that question.
- A Recommendations page showing up to eight ranked unfinished questions.
- Practice history, dashboard and JSON export.

## Run the project

1. Extract the ZIP file.
2. Open the extracted folder in **Visual Studio Code**.
3. Install the **Live Server** extension if it is not already installed.
4. Right-click `index.html` and choose **Open with Live Server**.
5. Enter a student name. A student ID is optional, but using the same ID restores the same profile in the same browser.
6. Open **Practice** to start the question stopwatch, write Python code, use **Run with custom input**, then choose **Submit & evaluate** to run all stored test cases.
7. After evaluation, review **Your Next Recommended Question** below the result and select **Start Recommended Practice** to open it directly. The Recommendations page separately lists up to eight unfinished questions.

Do not open `index.html` directly as a `file://` page; the question bank is loaded with `fetch`, so use a local web server.

## Mathematical model (aligned with the mid-review)

Concept order in all vectors: `[Arrays, Loops, Recursion, Sorting]`.

### 1. Performance score

- `C = passed test cases / total test cases`
- `T = max(0, 1 - elapsed seconds / time-limit seconds)`
- `D = 0.50` for Easy, `0.75` for Medium, `1.00` for Hard
- `P = 100 × [0.60C + 0.25T + 0.15(C × D)]`

The time limit is the question's `estimatedMinutes × 60`. The formula intentionally matches the mid-review. As noted in the review, this version still awards a time component when correctness is zero; gating the time term by correctness is a possible future refinement.

### 2. Skill matrix and learning need

For concept `k`, `Sₖ = mean(P) / 100` across all of that student's submitted attempts in the concept. The skill vector is `S`; the learning-need vector is `N = 1 - S`. A concept with no attempts uses a neutral initial estimate of `0.50` until evidence is available.

### 3. Cosine similarity

`cos(N,Q) = (N · Q) / (||N|| × ||Q||)`.

`Q` is the question's four-element concept vector. The question bank currently uses one-concept vectors; the ranking function also supports weighted multi-concept vectors.

### 4. Difficulty and recommendation score

- Skill below `0.50` → target Easy.
- Skill from `0.50` to below `0.75` → target Medium.
- Skill `0.75` or above → target Hard.
- Difficulty match: exact = `1.0`, one level away = `0.5`, two levels away = `0.0`.
- `Recommendation = 0.70 × cosine similarity + 0.30 × difficulty match`.

For a new learner, the app offers easy questions in a round-robin order across all four concepts, as specified in the mid-review.

## Storage and privacy

Profiles and attempt history are stored in the browser's LocalStorage on the device/browser used for practice. They are not automatically uploaded to a server. Use **Export student data (JSON)** to create a backup. Clearing browser site data will remove locally stored profiles unless they have been exported.

The JSON files in `students/` are empty starter files. A static browser app cannot silently write updated records back into those files; live student records are stored in LocalStorage and can be exported.

## Runtime and evaluation limitations

- The Python runtime is loaded from the Pyodide CDN. Internet access is needed the first time the runtime loads.
- The question bank includes visible sample tests used by the in-browser evaluator. This is an academic prototype, not a secure online judge. It does not isolate untrusted code in a separate server/container and does not enforce a hard execution timeout.
- Only Python execution is included. The mid-review's current prototype describes a Python code editor; C compilation is not claimed by this version.
- The scoring weights are project assumptions and have not been validated on a large real-student dataset.
- The current skill calculation uses the mean of all attempts, as described in the mid-review. Recency weighting is left as future work.

## Validate the project data

Run from the project folder:

```bash
python -m unittest discover -s tests -v
node --check js/app.js
node --test tests/test_app_logic.cjs
```

No Python packages are required for these validation checks.
