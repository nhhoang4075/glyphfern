import unittest

import context
from languages import language_of


class LanguageOfTest(unittest.TestCase):
    def test_spanish_voices_map_to_the_spanish_espeak_code(self):
        self.assertEqual(language_of("ef_dora"), "es")
        self.assertEqual(language_of("em_alex"), "es")

    def test_voices_without_a_table_entry_have_no_language(self):
        self.assertIsNone(language_of("af_heart"))
        self.assertIsNone(language_of(""))


if __name__ == "__main__":
    unittest.main()
