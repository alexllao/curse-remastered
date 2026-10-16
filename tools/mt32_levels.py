"""Ganancia lineal del render local: conserva dinámica, notas y duración."""
from array import array
import math
import sys
import wave

POLICY = 'rms-minus22-peak-minus2-v1'


def measure_gain(path):
    energy, count, peak = 0, 0, 0
    with wave.open(str(path), 'rb') as stream:
        if stream.getsampwidth() != 2 or stream.getcomptype() != 'NONE':
            raise ValueError('El render debe ser PCM de 16 bits')
        while chunk := stream.readframes(65536):
            samples = array('h', chunk)
            if sys.byteorder != 'little':
                samples.byteswap()
            count += len(samples)
            energy += sum(value * value for value in samples)
            peak = max(peak, max(abs(value) for value in samples))
    if not count or not peak:
        return {'policy': POLICY, 'gainDb': 0, 'silent': True}
    mean_db = 20 * math.log10(math.sqrt(energy / count) / 32768)
    peak_db = 20 * math.log10(peak / 32768)
    return {'policy': POLICY, 'gainDb': round(min(-22 - mean_db, -2 - peak_db), 4),
            'inputMeanDbfs': round(mean_db, 4), 'inputPeakDbfs': round(peak_db, 4),
            'targetMeanDbfs': -22, 'peakCeilingDbfs': -2}
