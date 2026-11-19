import io
import unittest
import wave

import numpy as np

import context
from audio import wav_bytes


class WavBytesTest(unittest.TestCase):
    def test_samples_become_a_mono_16_bit_wav_at_the_given_rate(self):
        samples = np.array([0.0, 0.5, -0.5, 2.0, -2.0], dtype=np.float32)
        with wave.open(io.BytesIO(wav_bytes(samples, 24000)), "rb") as reader:
            self.assertEqual(reader.getnchannels(), 1)
            self.assertEqual(reader.getsampwidth(), 2)
            self.assertEqual(reader.getframerate(), 24000)
            frames = np.frombuffer(reader.readframes(reader.getnframes()), dtype="<i2")
        self.assertEqual(frames.tolist(), [0, 16383, -16383, 32767, -32767])


if __name__ == "__main__":
    unittest.main()
