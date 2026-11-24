// Geometry of the pinned Magenta 1.23.1 piano model and its batchInput helper.
export const MAGENTA_AUDIO = Object.freeze({ sampleRate: 16000, hopLength: 512, nFft: 2048, chunkLength: 64 });

export function padMagentaInput(pcm) {
  const { hopLength, nFft, chunkLength } = MAGENTA_AUDIO;
  const receptiveFieldPad = 3; // Pinned upstream RF_PAD, on each side of a batch.
  const frames = Math.floor(pcm.length / hopLength) + 1;
  const fullBatchFrames = chunkLength + 2 * receptiveFieldPad;
  // Upstream merges remainders <= RF_PAD, but 68/69 frames form two unequal
  // batches before reaching the 70-frame padded width. Append silence only
  // across that gap. Also provide enough samples for FFT reflect padding.
  const requiredSamples = frames > chunkLength + receptiveFieldPad && frames < fullBatchFrames
    ? (fullBatchFrames - 1) * hopLength : nFft / 2;
  if (pcm.length >= requiredSamples) return pcm;
  const padded = new Float32Array(requiredSamples);
  padded.set(pcm);
  return padded;
}
