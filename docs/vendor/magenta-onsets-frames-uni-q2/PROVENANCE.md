# Magenta piano checkpoint

Unmodified `onsets_frames_uni_q2` weights from Google's Magenta.js hosted
checkpoint collection, downloaded 24 November 2026. This is the official
unidirectional Onsets and Frames model with two-byte quantized weights,
used with `@magenta/music` 1.23.1. No retraining or piece-specific tuning.

Upstream: https://storage.googleapis.com/magentadata/js/checkpoints/transcription/onsets_frames_uni_q2

The Magenta checkpoint catalog explicitly documents downloading and hosting
these files locally:
https://github.com/magenta/magenta-js/blob/master/music/checkpoints/README.md

Retained upstream Apache-2.0 license:
https://github.com/magenta/magenta-js/blob/master/LICENSE

Exact checkpoint manifest and shard bytes are pinned in `manifest.json`.
The release builder verifies these digests and references this same-origin,
versioned directory. Runtime compatibility changes affect JavaScript module
loading only, not the checkpoint or neural-network computation. See the demo
README for the worker adapter and preprocessing settings.
