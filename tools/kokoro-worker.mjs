// Kokoro synthesis worker. Installed next to the shared ai-tools
// node_modules (copied there by kokoroInstall) so the bare 'kokoro-js'
// import resolves against the managed install. Runs fully offline: remote
// model fetching is disabled, the model directory comes from the job file.
import fs from 'node:fs';
import {env as hfEnv} from '@huggingface/transformers';
import {KokoroTTS} from 'kokoro-js';

const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
hfEnv.allowRemoteModels = false;
hfEnv.allowLocalModels = true;
const tts = await KokoroTTS.from_pretrained(job.modelDir, {dtype: 'q8', device: 'cpu'});
const audio = await tts.generate(job.text, {voice: job.voice, speed: job.speed || 1});
audio.save(job.output);
console.log(JSON.stringify({ok: true, voice: job.voice, samplingRate: audio.sampling_rate}));
