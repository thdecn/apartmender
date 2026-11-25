// Magenta's browser compatibility module assumes window and constructs an unused
// OfflineAudioContext at import time. This worker only calls pure spectrogram
// functions and transcribeFromMelSpec; resampling stays in our Web Audio host.
export const fetch = self.fetch.bind(self);
export const performance = self.performance;
export const navigator = self.navigator;
export const isSafari = false;
export const getOfflineAudioContext = () => null;
export function unsupportedAudioBuffer() { throw new Error('Resample PCM before using the Magenta worker.'); }
