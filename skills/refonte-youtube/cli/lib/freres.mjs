// Sibling skills: the transcription comes from montage-youtube; the cloned voice, the sound effects and the
// master from pub-video; the caption font from video-verticale. Each is found through its command (a link
// into its skill folder) and its modules are imported from there, so the code lives in one place.
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SKILL, which } from './util.mjs';

export const SIBLINGS = ['montage-youtube', 'pub-video', 'video-verticale'];

// How to get a missing sibling: the aycode plugin ships them together, and install.sh sets up the ones next to it.
export const installHint = (cmd) =>
	`installe le plugin aycode complet (« /plugin install aycode@aycode ») ou copie le skill ${cmd} à côté de refonte-youtube, puis relance « bash ${join(SKILL, 'install.sh')} »`;

// Skill folder of a sibling command, or null when it is not installed.
export async function skillDir(cmd) {
	const bin = (await which(cmd)) ?? [join(homedir(), '.local/bin', cmd)].find((p) => existsSync(p));
	if (!bin) return null;
	const dir = resolve(dirname(realpathSync(bin)), '..');
	return existsSync(join(dir, 'SKILL.md')) ? dir : null;
}
async function needSkill(cmd) {
	const dir = await skillDir(cmd);
	if (!dir) throw new Error(`la commande ${cmd} est introuvable : ${installHint(cmd)}.`);
	return dir;
}
async function load(cmd, rel) {
	return import(pathToFileURL(join(await needSkill(cmd), rel)).href);
}

// montage-youtube: word-level transcription with whisper.cpp.
export const montage = {
	whisper: () => load('montage-youtube', 'cli/lib/whisper.mjs'),
	util: () => load('montage-youtube', 'cli/lib/util.mjs')
};
// pub-video: voicebox client, voice measures, sound effects and the master.
export const pub = {
	voicebox: () => load('pub-video', 'cli/lib/voicebox.mjs'),
	voice: () => load('pub-video', 'cli/lib/voice.mjs'),
	sfx: () => load('pub-video', 'cli/lib/sfx.mjs'),
	audio: () => load('pub-video', 'cli/lib/audio.mjs')
};
// video-verticale: Google Fonts download as TTF, for libass.
export const vv = {
	police: () => load('video-verticale', 'cli/lib/police.mjs')
};
