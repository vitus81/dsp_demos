import os
import sys
import unittest


sys.path.insert(0, os.path.dirname(__file__))

from ws_iq_generator import QpskRrcSource, create_source, parse_args


class QpskRrcSourceTest(unittest.TestCase):
    def test_consecutive_calls_return_requested_sample_counts(self):
        source = QpskRrcSource(seed=17)

        first = source.next_samples(13)
        second = source.next_samples(29)

        self.assertEqual(len(first), 13)
        self.assertEqual(len(second), 29)

    def test_output_is_deterministic_for_same_seed(self):
        first_source = QpskRrcSource(seed=23)
        second_source = QpskRrcSource(seed=23)

        self.assertEqual(
            first_source.next_samples(512),
            second_source.next_samples(512),
        )

    def test_long_stream_does_not_repeat_a_precomputed_waveform_boundary(self):
        source = QpskRrcSource(seed=31)
        first = source.next_samples(256)
        source.next_samples(32768)
        later = source.next_samples(256)

        self.assertNotEqual(first, later)

    def test_oqpsk_offsets_the_first_quadrature_impulse(self):
        source = QpskRrcSource(seed=41, offset_q=True)

        samples = source.next_samples(64)
        first_i_index = next(
            index for index, (i_value, _) in enumerate(samples) if abs(i_value) > 0
        )
        first_q_index = next(
            index for index, (_, q_value) in enumerate(samples) if abs(q_value) > 0
        )

        self.assertEqual(first_q_index - first_i_index, 4)

    def test_create_source_supports_oqpsk_rrc(self):
        args = parse_args(["--signal", "oqpsk-rrc"])

        self.assertIsInstance(create_source(args), QpskRrcSource)


if __name__ == "__main__":
    unittest.main()
