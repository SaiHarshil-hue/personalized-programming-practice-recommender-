import math
import unittest


def performance_score(correctness, elapsed_seconds, time_limit_seconds, difficulty_weight):
    time_score = max(0.0, 1.0 - elapsed_seconds / time_limit_seconds)
    return 100 * (0.60 * correctness + 0.25 * time_score + 0.15 * correctness * difficulty_weight)


def cosine_similarity(a, b):
    denominator = math.sqrt(sum(x*x for x in a)) * math.sqrt(sum(x*x for x in b))
    return sum(x*y for x, y in zip(a, b)) / denominator if denominator else 0.0


class MidReviewMathTests(unittest.TestCase):
    def test_mid_review_worked_performance_example(self):
        # 4/5 tests passed; 6 of 10 minutes used; Medium difficulty.
        score = performance_score(0.80, 360, 600, 0.75)
        self.assertAlmostEqual(score, 67.0, places=8)

    def test_learning_need_cosine_examples(self):
        need = [0.15, 0.22, 0.60, 0.35]
        recursion = [0, 0, 1, 0]
        recursion_and_sorting = [0, 0, 1, 1]
        self.assertAlmostEqual(cosine_similarity(need, recursion), 0.81, delta=0.02)
        self.assertAlmostEqual(cosine_similarity(need, recursion_and_sorting), 0.90, delta=0.02)

    def test_zero_vector_is_safe(self):
        self.assertEqual(cosine_similarity([0, 0, 0, 0], [1, 0, 0, 0]), 0.0)

    def test_difficulty_weighted_score_bounds(self):
        self.assertGreaterEqual(performance_score(0, 600, 600, 0.5), 0)
        self.assertLessEqual(performance_score(1, 0, 600, 1.0), 100)

if __name__ == '__main__':
    unittest.main()
