import json
import unittest

import context
from validation import MAX_TEXT_CHARACTERS, ValidationError, parse_request

VOICES = {"ef_dora", "em_alex"}


def body(**overrides) -> bytes:
    payload = {"text": "Hola", "voice": "ef_dora", "speed": 0.78}
    payload.update(overrides)
    return json.dumps(payload).encode("utf-8")


def code_of(raw: bytes) -> str:
    try:
        parse_request(raw, VOICES)
    except ValidationError as error:
        return error.code
    return "accepted"


class ParseRequestTest(unittest.TestCase):
    def test_a_valid_request_is_parsed_with_trimmed_text(self):
        request = parse_request(body(text="  Hola mundo \n"), VOICES)
        self.assertEqual(request.text, "Hola mundo")
        self.assertEqual(request.voice, "ef_dora")
        self.assertEqual(request.speed, 0.78)

    def test_integer_speed_and_the_range_edges_are_accepted(self):
        self.assertEqual(parse_request(body(speed=1), VOICES).speed, 1.0)
        self.assertEqual(parse_request(body(speed=0.5), VOICES).speed, 0.5)
        self.assertEqual(parse_request(body(speed=1.5), VOICES).speed, 1.5)

    def test_text_of_exactly_the_maximum_length_is_accepted(self):
        text = "a" * MAX_TEXT_CHARACTERS
        self.assertEqual(parse_request(body(text=text), VOICES).text, text)

    def test_invalid_json_and_non_objects_are_rejected(self):
        self.assertEqual(code_of(b"{nope"), "invalid_json")
        self.assertEqual(code_of(b"[1, 2]"), "invalid_json")
        self.assertEqual(code_of(b"\xff\xfe"), "invalid_json")
        self.assertEqual(code_of(b""), "invalid_json")
        self.assertEqual(code_of(b" " * (64 * 1024 + 1)), "invalid_json")

    def test_text_must_be_a_non_empty_string_within_the_limit(self):
        self.assertEqual(code_of(body(text=5)), "invalid_text")
        self.assertEqual(code_of(body(text="  \n ")), "invalid_text")
        self.assertEqual(code_of(body(text="a" * (MAX_TEXT_CHARACTERS + 1))), "invalid_text")
        self.assertEqual(code_of(b'{"voice": "ef_dora", "speed": 1}'), "invalid_text")

    def test_speed_must_be_a_number_within_the_range(self):
        self.assertEqual(code_of(body(speed=0.49)), "invalid_speed")
        self.assertEqual(code_of(body(speed=1.51)), "invalid_speed")
        self.assertEqual(code_of(body(speed="1")), "invalid_speed")
        self.assertEqual(code_of(body(speed=True)), "invalid_speed")
        self.assertEqual(code_of(body(speed=None)), "invalid_speed")
        self.assertEqual(code_of(b'{"text": "a", "voice": "ef_dora", "speed": NaN}'), "invalid_speed")

    def test_voice_must_be_in_the_loaded_list(self):
        self.assertEqual(code_of(body(voice="af_heart")), "invalid_voice")
        self.assertEqual(code_of(body(voice=3)), "invalid_voice")
        self.assertEqual(code_of(b'{"text": "a", "speed": 1}'), "invalid_voice")


if __name__ == "__main__":
    unittest.main()
