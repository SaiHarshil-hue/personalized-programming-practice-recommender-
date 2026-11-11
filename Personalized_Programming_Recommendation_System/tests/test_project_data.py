import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]

class QuestionBankTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.questions = json.loads((ROOT / 'data' / 'questions.json').read_text())
        cls.topics = json.loads((ROOT / 'data' / 'topics.json').read_text())

    def test_expected_question_count_and_concepts(self):
        self.assertEqual(len(self.questions), 30)
        self.assertEqual(self.topics, ['Arrays', 'Loops', 'Recursion', 'Sorting'])

    def test_every_question_has_valid_vector_and_tests(self):
        ids = set()
        for question in self.questions:
            self.assertNotIn(question['id'], ids)
            ids.add(question['id'])
            self.assertIn(question['topic'], self.topics)
            self.assertIn(question['difficulty'], ['Easy', 'Medium', 'Hard'])
            self.assertEqual(len(question['requiredSkillVector']), 4)
            self.assertTrue(all(isinstance(x, (int, float)) and 0 <= x <= 1 for x in question['requiredSkillVector']))
            self.assertGreater(sum(question['requiredSkillVector']), 0)
            self.assertGreaterEqual(len(question['testCases']), 2)
            for case in question['testCases']:
                self.assertIn('input', case)
                self.assertIn('expectedOutput', case)

    def test_all_concepts_have_questions_at_each_difficulty(self):
        for topic in self.topics:
            for difficulty in ['Easy', 'Medium', 'Hard']:
                self.assertTrue(any(q['topic'] == topic and q['difficulty'] == difficulty for q in self.questions), (topic, difficulty))

if __name__ == '__main__':
    unittest.main()
