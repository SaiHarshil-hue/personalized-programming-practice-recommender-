'use strict';

// SkillPath: Personalized Programming Practice Recommendation
// Concept order follows the Mathematics for Computing-I mid-review.
const CONCEPTS = ['Arrays', 'Loops', 'Recursion', 'Sorting'];
const DIFFICULTY_WEIGHT = { Easy: 0.50, Medium: 0.75, Hard: 1.00 };
const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard'];
const STORAGE_KEY = 'skillpath_students_v2';
let questions = [];
let student = null;
let currentQuestionIndex = 0;
let questionStartedAt = 0;
let timerElapsedMs = 0;
let timerHandle = null;
let timerActive = false;
let activeTimerQuestionId = null;
let questionHasLoaded = false;
let pyodide = null;
let isSubmitting = false;

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function loadStudents() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveStudents(students) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}
function persistStudent() {
  if (!student) return;
  const all = loadStudents();
  all[student.id] = student;
  saveStudents(all);
}
function createStudent(id, name) {
  return {
    schemaVersion: 2,
    id,
    name,
    skills: CONCEPTS.map(() => 0.50),
    history: [],
    completed: [],
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString()
  };
}
function getSkills() {
  return student?.skills?.length === CONCEPTS.length ? student.skills : CONCEPTS.map(() => 0.50);
}
function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }

function recalculateSkills() {
  student.skills = CONCEPTS.map((concept) => {
    const attempts = student.history.filter((item) => item.topic === concept && Number.isFinite(item.performanceScore));
    // A neutral 0.50 prior is used until a learner has an attempt in that concept.
    if (!attempts.length) return 0.50;
    return clamp01(attempts.reduce((sum, item) => sum + item.performanceScore, 0) / attempts.length / 100);
  });
  const meanSkill = student.skills.reduce((sum, value) => sum + value, 0) / CONCEPTS.length;
  student.overallLevel = targetDifficulty(meanSkill);
}

function targetDifficulty(skillScore) {
  if (skillScore < 0.50) return 'Easy';
  if (skillScore < 0.75) return 'Medium';
  return 'Hard';
}

function learningNeedVector(skills = getSkills()) {
  return skills.map((value) => 1 - clamp01(value));
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  if (normA === 0 || normB === 0) return 0;
  return Math.max(0, Math.min(1, dot / (normA * normB)));
}

function difficultyMatch(question) {
  const vector = question.requiredSkillVector || [];
  const totalWeight = vector.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (!totalWeight) return 0;
  return vector.reduce((sum, weight, index) => {
    if (weight <= 0) return sum;
    const target = targetDifficulty(getSkills()[index]);
    const gap = Math.abs(DIFFICULTY_ORDER.indexOf(question.difficulty) - DIFFICULTY_ORDER.indexOf(target));
    const match = gap === 0 ? 1 : gap === 1 ? 0.5 : 0;
    return sum + weight * match;
  }, 0) / totalWeight;
}

function recommendationDetails(question) {
  const similarity = cosineSimilarity(learningNeedVector(), question.requiredSkillVector);
  const levelMatch = difficultyMatch(question);
  const finalScore = 0.70 * similarity + 0.30 * levelMatch;
  return { similarity, levelMatch, finalScore };
}

function calculatePerformanceScore(correctness, elapsedSeconds, timeLimitSeconds, difficulty) {
  const C = clamp01(correctness);
  const T = Math.max(0, Math.min(1, 1 - elapsedSeconds / Math.max(1, timeLimitSeconds)));
  const D = DIFFICULTY_WEIGHT[difficulty] ?? DIFFICULTY_WEIGHT.Easy;
  // Formula used in the submitted mid-review: P = 100[0.60C + 0.25T + 0.15(C x D)].
  const P = 100 * (0.60 * C + 0.25 * T + 0.15 * (C * D));
  return { correctness: C, timeScore: T, difficultyWeight: D, performanceScore: Math.round(P * 100) / 100 };
}

function normaliseOutput(value) {
  return String(value ?? '').replace(/\r/g, '').trim().split(/\s+/).filter(Boolean).join(' ');
}

async function ensurePythonRuntime() {
  if (pyodide) return pyodide;
  if (typeof window.loadPyodide !== 'function') {
    throw new Error('Python runtime could not be loaded. Check your internet connection and reload the page.');
  }
  $('output').textContent = 'Loading Python runtime for the first time…';
  pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' });
  return pyodide;
}

async function executePython(source, input) {
  const runtime = await ensurePythonRuntime();
  runtime.globals.set('__skillpath_source', source);
  runtime.globals.set('__skillpath_input', input);
  const result = await runtime.runPythonAsync(`
import sys, io, traceback
_old_stdin, _old_stdout, _old_stderr = sys.stdin, sys.stdout, sys.stderr
_capture = io.StringIO()
try:
    sys.stdin = io.TextIOWrapper(io.BytesIO(__skillpath_input.encode('utf-8')), encoding='utf-8')
    sys.stdout = _capture
    sys.stderr = _capture
    exec(compile(__skillpath_source, '<submission>', 'exec'), {'__name__': '__main__'})
    _skillpath_result = _capture.getvalue()
except BaseException:
    _skillpath_result = _capture.getvalue() + traceback.format_exc()
finally:
    sys.stdin, sys.stdout, sys.stderr = _old_stdin, _old_stdout, _old_stderr
_skillpath_result
`);
  return String(result);
}

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}
function elapsedSeconds() {
  const runningMs = timerActive ? Date.now() - questionStartedAt : 0;
  return Math.max(0, Math.floor((timerElapsedMs + runningMs) / 1000));
}
function updateTimerDisplay() {
  $('timer').textContent = formatTimer(elapsedSeconds());
}
function pauseTimer() {
  if (timerActive) {
    timerElapsedMs += Math.max(0, Date.now() - questionStartedAt);
    timerActive = false;
  }
  if (timerHandle !== null) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
  updateTimerDisplay();
}
function startTimer() {
  const question = questions[currentQuestionIndex];
  if (!question || isSubmitting || student?.completed?.includes(question.id)) return;
  if (activeTimerQuestionId !== question.id) {
    pauseTimer();
    activeTimerQuestionId = question.id;
    timerElapsedMs = 0;
  }
  if (timerActive) return;
  questionStartedAt = Date.now();
  timerActive = true;
  updateTimerDisplay();
  if (timerHandle !== null) clearInterval(timerHandle);
  timerHandle = setInterval(updateTimerDisplay, 1000);
}
function resetTimerForQuestion(questionId) {
  pauseTimer();
  activeTimerQuestionId = questionId;
  timerElapsedMs = 0;
  updateTimerDisplay();
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach((page) => page.classList.add('hidden'));
  $(pageId)?.classList.remove('hidden');
  document.querySelectorAll('nav button').forEach((button) => button.classList.toggle('active', button.dataset.page === pageId));
  if (pageId === 'home') renderDashboard();
  if (pageId === 'practice') {
    if (!questionHasLoaded) loadQuestion(currentQuestionIndex);
    else if (!student?.completed?.includes(questions[currentQuestionIndex]?.id)) startTimer();
  } else if (timerActive) {
    pauseTimer();
  }
  if (pageId === 'recommend') renderRecommendations();
  if (pageId === 'history') renderHistory();
}

function renderDashboard() {
  if (!student) return;
  const attempts = student.history.length;
  const average = attempts ? student.history.reduce((sum, item) => sum + item.performanceScore, 0) / attempts : null;
  $('stats').innerHTML = [
    ['Attempts', attempts],
    ['Questions completed', student.completed.length],
    ['Average performance', average === null ? '—' : `${average.toFixed(1)}%`],
    ['Overall skill level', student.overallLevel || 'Medium']
  ].map(([label, value]) => `<div class="stat"><span class="small">${label}</span><strong>${value}</strong></div>`).join('');
  $('skills').innerHTML = CONCEPTS.map((concept, index) => {
    const value = Math.round(getSkills()[index] * 100);
    const attemptsForConcept = student.history.filter((item) => item.topic === concept).length;
    return `<div class="skill"><div class="row between"><b>${concept}</b><span>${value}% <span class="small">(${attemptsForConcept} attempts)</span></span></div><div class="bar"><span style="width:${value}%"></span></div></div>`;
  }).join('');
  $('dashboardNote').textContent = attempts ? 'Skill scores are the mean performance score for each concept, scaled to 0–1. Concepts with no attempts retain the neutral starting value of 0.50.' : 'No attempts yet. Your initial profile is neutral, and the system will offer balanced easy questions across all four concepts.';
}

function populateQuestionPicker() {
  const picker = $('questionPicker');
  picker.innerHTML = questions.map((question, index) => `<option value="${index}">${question.id} · ${escapeHtml(question.topic)} · ${escapeHtml(question.title)}</option>`).join('');
  picker.value = String(currentQuestionIndex);
}

function loadQuestion(index) {
  if (!questions.length) return;
  const nextIndex = (index + questions.length) % questions.length;
  const switchingQuestion = !questionHasLoaded || nextIndex !== currentQuestionIndex;
  if (switchingQuestion) pauseTimer();
  currentQuestionIndex = nextIndex;
  const question = questions[currentQuestionIndex];
  questionHasLoaded = true;
  $('qTitle').textContent = question.title;
  $('qTopic').textContent = question.topic;
  $('qDiff').textContent = question.difficulty;
  $('qStatement').textContent = question.statement;
  $('sample').textContent = `Input:\n${question.sampleInput}Output:\n${question.sampleOutput}`;
  $('constraints').textContent = `${question.constraints} Estimated time: ${question.estimatedMinutes} minutes.`;
  $('questionPicker').value = String(currentQuestionIndex);
  $('code').value = '# Write your Python solution here\n';
  $('customInput').value = question.sampleInput;
  $('output').textContent = 'Ready. Run your code with the sample input, then submit for test-case evaluation.';
  $('submissionResult').innerHTML = '';
  $('submitBtn').disabled = student?.completed?.includes(question.id) || false;
  if (student?.completed?.includes(question.id)) {
    $('submissionResult').innerHTML = '<p class="notice">You have already completed this question. Choose an unfinished question to continue.</p>';
  }
  if (switchingQuestion) resetTimerForQuestion(question.id);
  if (!$('practice').classList.contains('hidden') && !student?.completed?.includes(question.id)) startTimer();
}

function getRankedQuestions(limit = 8) {
  if (!student) return [];
  const attempted = student.history.length > 0;
  const available = questions.filter((question) => !student.completed.includes(question.id));
  if (!attempted) {
    // Keep the existing balanced starter behaviour for a new learner.
    const pools = CONCEPTS.map((concept) => available.filter((question) => question.topic === concept && question.difficulty === 'Easy'));
    const ranked = [];
    let position = 0;
    while (ranked.length < limit && pools.some((pool) => pool[position])) {
      pools.forEach((pool) => {
        if (pool[position] && ranked.length < limit) {
          ranked.push({ ...pool[position], ...recommendationDetails(pool[position]) });
        }
      });
      position += 1;
    }
    return ranked;
  }
  return available
    .map((question) => ({ ...question, ...recommendationDetails(question) }))
    .sort((a, b) => b.finalScore - a.finalScore || a.title.localeCompare(b.title))
    .slice(0, limit);
}

function renderRecommendations() {
  if (!student) return;
  const attempted = student.history.length > 0;
  const ranked = getRankedQuestions(8);
  $('recommendationIntro').textContent = attempted
    ? 'Ranked using 70% cosine similarity between learning need and question concepts, plus 30% difficulty match.'
    : 'New learner profile: a balanced starter set of easy questions, with coverage across Arrays, Loops, Recursion and Sorting.';
  $('recommendations').innerHTML = ranked.length ? ranked.map((question, index) => `
    <article class="recommendCard">
      <div class="row between"><div><span class="rank">#${index + 1}</span> <b>${escapeHtml(question.title)}</b></div><span class="pill">${escapeHtml(question.topic)} · ${escapeHtml(question.difficulty)}</span></div>
      <p class="small">Cosine similarity: ${question.similarity.toFixed(3)} · Difficulty match: ${question.levelMatch.toFixed(1)} · Final score: ${question.finalScore.toFixed(3)}</p>
      <p>${escapeHtml(question.statement)}</p>
      <button data-practice-index="${questions.findIndex((item) => item.id === question.id)}">Practice this question</button>
    </article>`).join('') : '<p>You have completed all available questions. Export your history or reset your profile to practise again.</p>';
  $('recommendations').querySelectorAll('[data-practice-index]').forEach((button) => {
    button.addEventListener('click', () => { loadQuestion(Number(button.dataset.practiceIndex)); showPage('practice'); });
  });
}

function recommendationExplanation(question) {
  const strongestNeedIndex = learningNeedVector().reduce(
    (bestIndex, value, index, vector) => value > vector[bestIndex] ? index : bestIndex, 0);
  const strongestNeed = CONCEPTS[strongestNeedIndex];
  const conceptIndex = CONCEPTS.indexOf(question.topic);
  const conceptNeed = learningNeedVector()[conceptIndex] ?? 0;
  if (!student.history.length) {
    return `Balanced starter practice: this easy question helps begin coverage of ${question.topic} while your profile is still at its neutral starting values.`;
  }
  const relation = question.topic === strongestNeed
    ? `${question.topic} is currently your highest learning-need area`
    : `${question.topic} contributes to your learning needs (need ${conceptNeed.toFixed(2)})`;
  return `Selected because ${relation}; its cosine similarity is ${question.similarity.toFixed(3)} and its difficulty match is ${question.levelMatch.toFixed(3)}.`;
}

function showNextRecommendation() {
  const container = $('submissionResult');
  const previous = container.querySelector('.nextRecommendation');
  if (previous) previous.remove();
  if (!student) return;
  const ranked = getRankedQuestions(8);
  if (!ranked.length) {
    container.insertAdjacentHTML('beforeend',
      '<section class="nextRecommendation"><h3>Your Next Recommended Question</h3><p>You have completed all available questions. Great work!</p></section>');
    return;
  }
  const question = ranked[0];
  const questionIndex = questions.findIndex((item) => item.id === question.id);
  container.insertAdjacentHTML('beforeend', `
    <section class="nextRecommendation" aria-live="polite">
      <div class="row between">
        <span class="pill">Your Next Recommended Question</span>
        <span class="rank">#1</span>
      </div>
      <h3>${escapeHtml(question.title)}</h3>
      <p class="small">${escapeHtml(question.topic)} · ${escapeHtml(question.difficulty)}</p>
      <p class="small">Cosine similarity: ${question.similarity.toFixed(3)} · Difficulty match: ${question.levelMatch.toFixed(3)} · Final recommendation score: ${question.finalScore.toFixed(3)}</p>
      <p>${escapeHtml(recommendationExplanation(question))}</p>
      <button id="startRecommendedBtn" type="button">Start Recommended Practice</button>
    </section>
  `);
  $('startRecommendedBtn').addEventListener('click', () => {
    loadQuestion(questionIndex);
    showPage('practice');
  });
}

function renderHistory() {
  if (!student) return;
  if (!student.history.length) {
    $('historyList').innerHTML = '<p>No attempts yet. Complete a practice question to see your results here.</p>';
    return;
  }
  $('historyList').innerHTML = [...student.history].reverse().map((item) => `
    <article class="historyItem">
      <div class="row between"><b>${escapeHtml(item.title)}</b><span class="pill">${escapeHtml(item.topic)} · ${escapeHtml(item.difficulty)}</span></div>
      <p class="small">${new Date(item.date).toLocaleString()} · ${item.passedTests}/${item.totalTests} tests passed · ${item.elapsedSeconds}s</p>
      <p>Correctness: ${(item.correctness * 100).toFixed(1)}% · Time score: ${(item.timeScore * 100).toFixed(1)}% · Performance: <b>${item.performanceScore.toFixed(2)} / 100</b></p>
    </article>`).join('');
}


async function runCurrentCode() {
  const source = $('code').value;
  const input = $('customInput').value;
  $('runBtn').disabled = true;
  $('output').textContent = 'Running Python…';
  try {
    const output = await executePython(source, input);
    $('output').textContent = output || '(No output)';
  } catch (error) {
    $('output').textContent = `Runtime error: ${error.message || error}`;
  } finally {
    $('runBtn').disabled = false;
  }
}

async function submitCurrentCode() {
  if (!student || isSubmitting) return;
  const question = questions[currentQuestionIndex];
  if (student.completed.includes(question.id)) {
    $('submissionResult').textContent = 'This question has already been submitted for this student. Choose another question to continue.';
    return;
  }
  isSubmitting = true;
  $('submitBtn').disabled = true;
  $('runBtn').disabled = true;
  $('prevQ').disabled = true;
  $('nextQ').disabled = true;
  $('questionPicker').disabled = true;
  const elapsed = elapsedSeconds();
  pauseTimer();
  const source = $('code').value;
  let passed = 0;
  const details = [];
  try {
    await ensurePythonRuntime();
  } catch (error) {
    $('output').textContent = `Python runtime unavailable: ${error.message || error}. No attempt was recorded.`;
    $('submitBtn').disabled = false;
    $('runBtn').disabled = false;
    $('prevQ').disabled = false;
    $('nextQ').disabled = false;
    $('questionPicker').disabled = false;
    isSubmitting = false;
    if (!$('practice').classList.contains('hidden')) startTimer();
    return;
  }
  try {
    for (let index = 0; index < question.testCases.length; index += 1) {
      const test = question.testCases[index];
      const actual = await executePython(source, test.input);
      const success = normaliseOutput(actual) === normaliseOutput(test.expectedOutput);
      if (success) passed += 1;
      details.push({ number: index + 1, success, expected: test.expectedOutput, actual });
    }
  } catch (error) {
    details.push({ number: details.length + 1, success: false, expected: '', actual: `Evaluation error: ${error.message || error}` });
  }
  const total = question.testCases.length;
  const correctness = total ? passed / total : 0;
  const timeLimit = question.estimatedMinutes * 60;
  const score = calculatePerformanceScore(correctness, elapsed, timeLimit, question.difficulty);
  const record = {
    questionId: question.id,
    title: question.title,
    topic: question.topic,
    difficulty: question.difficulty,
    elapsedSeconds: elapsed,
    timeLimitSeconds: timeLimit,
    passedTests: passed,
    totalTests: total,
    correctness: score.correctness,
    timeScore: score.timeScore,
    difficultyWeight: score.difficultyWeight,
    performanceScore: score.performanceScore,
    date: new Date().toISOString()
  };
  student.history.push(record);
  student.completed = [...new Set([...student.completed, question.id])];
  student.lastActiveAt = new Date().toISOString();
  recalculateSkills();
  persistStudent();
  $('timer').textContent = formatTimer(elapsed);
  const detailHtml = details.map((item) => `<li class="${item.success ? 'pass' : 'fail'}">Test ${item.number}: ${item.success ? 'Passed' : 'Failed'}${item.actual && !item.success ? `<pre>${escapeHtml(item.actual)}</pre>` : ''}</li>`).join('');
  $('submissionResult').innerHTML = `<div class="resultSummary"><b>${passed}/${total} test cases passed</b><span>Performance score: ${score.performanceScore.toFixed(2)} / 100</span></div><p> C = ${correctness.toFixed(2)} · T = ${score.timeScore.toFixed(2)} · D = ${score.difficultyWeight.toFixed(2)}</p><details><summary>Test-case details</summary><ul>${detailHtml}</ul></details><p class="small">Your ${question.topic} skill has been recalculated from the mean performance score of all attempts in this concept.</p>`;
  $('output').textContent = `Evaluation complete: ${passed} of ${total} test cases passed.`;
  $('runBtn').disabled = false;
  $('submitBtn').disabled = true;
  $('prevQ').disabled = false;
  $('nextQ').disabled = false;
  $('questionPicker').disabled = false;
  isSubmitting = false;
  renderDashboard();
  showNextRecommendation();
}

function exportStudentData() {
  if (!student) return;
  const blob = new Blob([JSON.stringify(student, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `skillpath-${student.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function startSession() {
  const name = $('studentName').value.trim();
  if (!name) { alert('Please enter your name.'); return; }
  const suppliedId = $('studentId').value.trim();
  const id = suppliedId || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'student';
  const all = loadStudents();
  student = all[id] || createStudent(id, name);
  student.name = name;
  if (!Array.isArray(student.history)) student.history = [];
  if (!Array.isArray(student.completed)) student.completed = [];
  recalculateSkills();
  persistStudent();
  $('login').classList.add('hidden');
  $('greeting').textContent = `Welcome back, ${name}`;
  renderDashboard();
  populateQuestionPicker();
  questionHasLoaded = false;
  currentQuestionIndex = 0;
  showPage('home');
}

async function init() {
  try {
    const response = await fetch('data/questions.json');
    if (!response.ok) throw new Error(`Could not load question bank (${response.status}).`);
    questions = await response.json();
    const valid = questions.every((question) => Array.isArray(question.requiredSkillVector) && question.requiredSkillVector.length === CONCEPTS.length && question.testCases?.length);
    if (!valid) throw new Error('The question bank has an invalid vector or missing test cases.');
    $('questionCount').textContent = `${questions.length} practice questions · ${CONCEPTS.length} concepts`;
    showPage('home');
  } catch (error) {
    $('startupError').textContent = `${error.message} Please run this folder through VS Code Live Server rather than opening the HTML file directly.`;
    $('startupError').classList.remove('hidden');
  }
}

document.querySelectorAll('nav button').forEach((button) => button.addEventListener('click', () => showPage(button.dataset.page)));
$('startBtn').addEventListener('click', startSession);
$('prevQ').addEventListener('click', () => loadQuestion(currentQuestionIndex - 1));
$('nextQ').addEventListener('click', () => loadQuestion(currentQuestionIndex + 1));
$('questionPicker').addEventListener('change', (event) => loadQuestion(Number(event.target.value)));
$('runBtn').addEventListener('click', runCurrentCode);
$('submitBtn').addEventListener('click', submitCurrentCode);
$('exportBtn').addEventListener('click', exportStudentData);
$('themeBtn').addEventListener('click', () => document.body.classList.toggle('light'));
$('studentName').addEventListener('keydown', (event) => { if (event.key === 'Enter') startSession(); });

init();
