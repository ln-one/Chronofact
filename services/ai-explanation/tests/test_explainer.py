import json
import unittest
from pathlib import Path

from chronofact_ai.explainer import ALLOWED_OUTPUT_KEYS, explain_evidence


ROOT = Path(__file__).resolve().parents[1]


class ExplainerTest(unittest.TestCase):
    def test_all_mocks_return_fixed_contract(self):
        for path in (ROOT / "mock").glob("*.json"):
            with self.subTest(path=path.name):
                payload = json.loads(path.read_text(encoding="utf-8"))
                result = explain_evidence(payload)
                self.assertEqual(set(result), ALLOWED_OUTPUT_KEYS)
                self.assertIsInstance(result["summary"], str)
                self.assertIsInstance(result["risks"], list)
                self.assertIsInstance(result["next_checks"], list)
                self.assertIsInstance(result["confidence_note"], str)
                self.assertIsInstance(result["evidence_basis"], list)
                self.assertIn("不构成真实性证明", result["confidence_note"])

    def test_digest_mismatch_is_not_success(self):
        payload = json.loads((ROOT / "mock" / "digest-mismatch.json").read_text(encoding="utf-8"))
        result = explain_evidence(payload)
        text = json.dumps(result, ensure_ascii=False)
        self.assertIn("digest mismatch", text)
        self.assertNotIn("验证成功", result["summary"])
        self.assertIn("不能按已验证状态展示", result["summary"])


if __name__ == "__main__":
    unittest.main()
