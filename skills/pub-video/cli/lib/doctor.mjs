// doctor: check every tool the skill relies on and say how to install what is missing.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, SKILL, run, which, findWhisper } from './util.mjs';

export const booleans = ['selftest', 'help'];
const HELP = `pub-video doctor [--selftest]
    Vérifie Node, FFmpeg, le runtime partagé, Chromium, et les outils optionnels (yt-dlp, whisper.cpp).
    --selftest : rend 2 secondes de la démo pour prouver que toute la chaîne fonctionne.`;

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const rows = [];
	let missing = 0;
	const add = (ok, name, detail, fix, optional = false) => {
		rows.push([ok ? 'ok ' : optional ? ' – ' : 'KO ', name, ok ? detail : `${detail ? detail + '. ' : ''}${fix}`]);
		if (!ok && !optional) missing++;
	};

	const major = Number(process.versions.node.split('.')[0]);
	add(major >= 20, 'Node.js', `v${process.versions.node}`, 'Installe Node 20 ou plus (https://nodejs.org).');

	const ff = await run('ffmpeg', ['-hide_banner', '-version']);
	const ffv = /ffmpeg version (\S+)/.exec(ff.out)?.[1];
	add(!ff.code, 'FFmpeg', ffv, 'Installe-le : « sudo apt install -y ffmpeg » (Linux) ou « brew install ffmpeg » (macOS).');
	if (!ff.code) {
		const enc = (await run('ffmpeg', ['-hide_banner', '-encoders'])).out;
		const fil = (await run('ffmpeg', ['-hide_banner', '-filters'])).out;
		const need = [['libx264', enc], ['aac', enc], ['tmix', fil], ['ebur128', fil], ['alimiter', fil], ['xstack', fil]];
		const lacking = need.filter(([n, src]) => !new RegExp(`\\s${n}\\s`).test(src)).map(([n]) => n);
		add(!lacking.length, 'FFmpeg : codecs et filtres', 'libx264, aac, tmix, ebur128, alimiter', `Il manque ${lacking.join(', ')} : installe un FFmpeg complet.`);
		add(/\ssubtitles\s/.test(fil), 'FFmpeg : sous-titres incrustés', 'filtre subtitles (libass)', 'Sans libass, la vidéo guide de voix off n’aura pas de texte incrusté.', true);
	}
	add(!(await run('ffprobe', ['-version'])).code, 'ffprobe', '', 'Il est fourni avec FFmpeg.');

	const pkg = (n) => join(DATA, 'node_modules', n, 'package.json');
	const ver = (n) => (existsSync(pkg(n)) ? JSON.parse(readFileSync(pkg(n), 'utf8')).version : null);
	const fixRuntime = `Lance : bash ${join(SKILL, 'install.sh')}`;
	add(!!ver('playwright'), 'Playwright (runtime partagé)', `${ver('playwright')} dans ${DATA}`, fixRuntime);
	add(!!ver('gsap'), 'GSAP (runtime partagé)', ver('gsap'), fixRuntime);
	if (ver('playwright')) {
		let ok = true;
		let why = '';
		try {
			const { launch } = await import('./browser.mjs');
			const br = await launch();
			why = `Chromium ${br.version()}`;
			await br.close();
		} catch (e) {
			ok = false;
			why = String(e.message).split('\n')[0];
		}
		add(ok, 'Chromium sans écran', why, fixRuntime);
	}
	add(!!(await which('pub-video')), 'commande pub-video', 'dans le PATH', `${fixRuntime} (crée le lien dans ~/.local/bin)`);

	const yt = await which('yt-dlp');
	add(!!yt, 'yt-dlp (vidéos de référence)', yt, 'Optionnel. Utile seulement pour télécharger une vidéo de référence.', true);
	const wh = await findWhisper();
	add(!!wh, 'whisper.cpp (texte parlé)', wh ? `${wh.bin} · ${wh.model.split('/').pop()}` : '', 'Optionnel. Sert à transcrire une référence et à caler la voix off enregistrée.', true);
	const vb = await (await import('./voicebox.mjs')).connect();
	add(!!vb.url, 'voicebox (voix de synthèse)', vb.url, 'Optionnel. Génère la voix off avec une voix clonée (https://github.com/jamiepine/voicebox) ; profils : « pub-video voice profils ».', true);

	for (const [s, n, d] of rows) console.log(`${s} ${n.padEnd(34)} ${d ?? ''}`);
	console.log(`\nDossier du skill : ${SKILL}\nDémo technique   : ${join(SKILL, 'demo', 'videos', 'demo.html')}`);
	if (missing) {
		console.log(`\n${missing} outil(s) requis manquant(s).`);
		process.exit(1);
	}
	console.log('\nTout le nécessaire est installé.');
	if (a.selftest) await (await import('./selftest.mjs')).default();
}
