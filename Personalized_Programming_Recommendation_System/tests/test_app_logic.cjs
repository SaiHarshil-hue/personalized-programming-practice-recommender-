'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const appLogic = appSource.slice(0, appSource.lastIndexOf("document.querySelectorAll('nav button')"));
const questions = JSON.parse(fs.readFileSync(path.join(root, 'data', 'questions.json'), 'utf8'));

function createContext() {
  let now = 1_000_000;
  let nextIntervalId = 1;
  const intervals = new Set();
  const timerElement = { textContent: '' };
  const context = {
    console,
    Math,
    JSON,
    Number,
    Date: class extends Date { static now() { return now; } },
    setInterval: () => {
      const id = nextIntervalId++;
      intervals.add(id);
      return id;
    },
    clearInterval: (id) => intervals.delete(id),
    document: {
      getElementById: (id) => id === 'timer' ? timerElement : { textContent: '' }
    },
    window: {},
    localStorage: { getItem: () => '{}', setItem: () => {} }
  };
  vm.createContext(context);
  vm.runInContext(appLogic, context);
  vm.runInContext(`questions = ${JSON.stringify(questions)}`, context);
  return {
    context,
    intervals,
    advance: (milliseconds) => { now += milliseconds; },
    setStudent: (value) => vm.runInContext(`student = ${JSON.stringify(value)}`, context),
    run: (code) => vm.runInContext(code, context)
  };
}

test('performance score matches the submitted PPT formula', () => {
  const env = createContext();
  const score = env.run("calculatePerformanceScore(0.8, 360, 600, 'Medium')");
  assert.equal(score.correctness, 0.8);
  assert.equal(score.timeScore, 0.4);
  assert.equal(score.difficultyWeight, 0.75);
  assert.equal(score.performanceScore, 67);
});


test('learner skills, learning need, cosine similarity and difficulty match follow the PPT model', () => {
  const env = createContext();
  env.setStudent({
    id: 'math', name: 'Math', skills: [0.5, 0.5, 0.5, 0.5],
    history: [
      { topic: 'Arrays', performanceScore: 80 },
      { topic: 'Arrays', performanceScore: 60 }
    ],
    completed: []
  });
  env.run('recalculateSkills()');
  const skills = env.run('getSkills()');
  assert.deepEqual([...skills], [0.7, 0.5, 0.5, 0.5]);
  assert.deepEqual([...env.run('learningNeedVector()')].map((value) => Number(value.toFixed(6))), [0.3, 0.5, 0.5, 0.5]);
  assert.equal(env.run('cosineSimilarity([1,0,0,0],[1,0,0,0])'), 1);
  assert.equal(env.run('cosineSimilarity([1,0,0,0],[0,1,0,0])'), 0);
  env.run('student.skills[0] = 0.2');
  assert.equal(env.run("difficultyMatch({difficulty:'Easy',requiredSkillVector:[1,0,0,0]})"), 1);
  assert.equal(env.run("difficultyMatch({difficulty:'Medium',requiredSkillVector:[1,0,0,0]})"), 0.5);
  assert.equal(env.run("difficultyMatch({difficulty:'Hard',requiredSkillVector:[1,0,0,0]})"), 0);
  env.run('student.skills[0] = 0.6');
  assert.equal(env.run("difficultyMatch({difficulty:'Medium',requiredSkillVector:[1,0,0,0]})"), 1);
});

test('different learner histories can produce different top recommendations', () => {
  const env = createContext();
  env.setStudent({
    id: 'learner-a', name: 'Learner A', skills: [0.5, 0.5, 0.5, 0.5],
    history: [
      { topic: 'Arrays', performanceScore: 20 },
      { topic: 'Loops', performanceScore: 90 },
      { topic: 'Recursion', performanceScore: 80 },
      { topic: 'Sorting', performanceScore: 75 }
    ],
    completed: []
  });
  env.run('recalculateSkills()');
  const firstTop = env.run('getRankedQuestions(8)')[0];
  env.setStudent({
    id: 'learner-b', name: 'Learner B', skills: [0.5, 0.5, 0.5, 0.5],
    history: [
      { topic: 'Arrays', performanceScore: 95 },
      { topic: 'Loops', performanceScore: 20 },
      { topic: 'Recursion', performanceScore: 25 },
      { topic: 'Sorting', performanceScore: 30 }
    ],
    completed: []
  });
  env.run('recalculateSkills()');
  const secondTop = env.run('getRankedQuestions(8)')[0];
  assert.notEqual(firstTop.id, secondTop.id);
});

test('completed questions are excluded and recommendation list is capped at eight', () => {
  const env = createContext();
  env.setStudent({
    id: 'learner', name: 'Learner', skills: [0.5, 0.5, 0.5, 0.5],
    history: [{ topic: 'Arrays', performanceScore: 45 }], completed: ['Q01']
  });
  const ranked = env.run('getRankedQuestions(8)');
  assert.ok(ranked.length <= 8);
  assert.ok(ranked.every((question) => question.id !== 'Q01'));
  env.run(`student.completed = ${JSON.stringify(questions.map((q) => q.id))}`);
  assert.equal(env.run('getRankedQuestions(8).length'), 0);
});

test('cold-start recommendations remain easy and balanced across all four concepts', () => {
  const env = createContext();
  env.setStudent({ id: 'new', name: 'New learner', skills: [0.5, 0.5, 0.5, 0.5], history: [], completed: [] });
  const ranked = env.run('getRankedQuestions(8)');
  assert.equal(ranked.length, 8);
  assert.deepEqual([...new Set(ranked.map((question) => question.topic))].sort(),
    ['Arrays', 'Loops', 'Recursion', 'Sorting'].sort());
  assert.ok(ranked.every((question) => question.difficulty === 'Easy'));
});

test('timer starts once, pauses without losing time, and resumes the same attempt', () => {
  const env = createContext();
  env.setStudent({ id: 'timer', name: 'Timer', skills: [0.5, 0.5, 0.5, 0.5], history: [], completed: [] });
  env.run('currentQuestionIndex = 0; startTimer(); startTimer()');
  assert.equal(env.intervals.size, 1);
  env.advance(2_500);
  assert.equal(env.run('elapsedSeconds()'), 2);
  env.run('pauseTimer()');
  assert.equal(env.intervals.size, 0);
  const pausedAt = env.run('elapsedSeconds()');
  env.advance(5_000);
  assert.equal(env.run('elapsedSeconds()'), pausedAt);
  env.run('startTimer()');
  env.advance(1_500);
  assert.equal(env.run('elapsedSeconds()'), 4);
  env.run('pauseTimer()');
  assert.equal(env.intervals.size, 0);
  assert.equal(env.run('formatTimer(61)'), '01:01');
});

test('timer does not start for a completed question', () => {
  const env = createContext();
  env.setStudent({
    id: 'done', name: 'Done', skills: [0.5, 0.5, 0.5, 0.5], history: [],
    completed: [questions[0].id]
  });
  env.run('currentQuestionIndex = 0; startTimer()');
  assert.equal(env.intervals.size, 0);
});
