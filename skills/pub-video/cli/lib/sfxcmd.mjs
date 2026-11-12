// sfx: list the built-in sounds, or replace one with a real recording.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { projectRoot, ffmpeg } from './util.mjs';
import { ABOUT, GAIN } from './sfx.mjs';

export const booleans = ['help'];
const HELP = `pub-video sfx list
    Les bruitages intégrés (fabriqués par le skill, sans fichier ni licence) et leur usage.
pub-video sfx get <type> <id Mixkit | url | fichier>
    Remplace un bruitage intégré par un enregistrement réel : le fichier va dans audio/sfx/<type>.wav et sera
    utilisé pour tous les repères de ce type. Les bruitages Mixkit sont sous « Sound Effects Free License »
    (pubs en ligne autorisées, sans crédit ; pas de redistribution du fichier seul). Catégories à parcourir :
    https://mixkit.co/free-sound-effects/<whoosh|click|impact|notification|pop|swish|transition|interface|coin|win>/`;

export default async function (_cmd, a) {
	const sub = a._[0];
	if (a.help || !sub) return console.log(HELP);
	if (sub === 'list') {
		for (const [k, d] of Object.entries(ABOUT)) console.log(`  ${k.padEnd(10)} ${d}`);
		console.log(`\n  Dans une scène : s.cue(temps, 'type', { v: volume, pitch, pan, d: durée, hole: 0.25 }). ${Object.keys(GAIN).length} sons.`);
		return;
	}
	if (sub === 'get') {
		const [, type, src] = a._;
		if (!type || !src) throw new Error('usage : pub-video sfx get <type> <id Mixkit | url | fichier>');
		const root = projectRoot();
		const dir = join(root, 'audio', 'sfx');
		await mkdir(dir, { recursive: true });
		const url = /^\d+$/.test(src) ? `https://assets.mixkit.co/active_storage/sfx/${src}/${src}.wav` : src;
		let input = url;
		if (/^https?:/.test(url)) {
			const r = await fetch(url);
			if (!r.ok) throw new Error(`téléchargement impossible (${r.status}) : ${url}`);
			input = join(dir, `.${type}.tmp`);
			await writeFile(input, Buffer.from(await r.arrayBuffer()));
		}
		await ffmpeg(['-i', input, '-ac', '1', '-ar', '48000', join(dir, `${type}.wav`)]);
		const log = join(dir, 'sources.json');
		const list = existsSync(log) ? JSON.parse(await readFile(log, 'utf8')) : [];
		list.push({ type, source: url, licence: /mixkit/.test(url) ? 'Mixkit Sound Effects Free License, https://mixkit.co/license/#sfxFree' : 'à vérifier', downloaded: new Date().toISOString().slice(0, 10) });
		await writeFile(log, JSON.stringify(list, null, 1));
		console.log(`  audio/sfx/${type}.wav remplace le bruitage « ${type} » dans ce projet.`);
		return;
	}
	throw new Error(`sous-commande inconnue « ${sub} » (list, get).`);
}
