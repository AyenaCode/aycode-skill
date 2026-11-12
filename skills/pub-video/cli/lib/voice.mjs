// voice: the voice-over, from script to mix. The script lives in audio/voix/<video>.txt, one line per
// scene; it is checked against the time each scene gives it, turned into subtitles and a recording
// guide, and once recorded each take is cleaned, placed on its scene and mixed (the music ducks under it).
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { projectRoot, videoFile, ffmpeg, run, fmt, num, pad } from './util.mjs';
import { openVideo } from './browser.mjs';
import { loudness } from './audio.mjs';

export const booleans = ['help'];
const HELP = `Le script : audio/voix/<vidéo>.txt, une ligne par réplique, au choix :
      nom-de-scène | texte            la réplique occupe la scène
      nom-de-scène+0.5 | texte        elle commence 0,5 s après le début de la scène
      3.0-5.5 | texte                 secondes exactes
    (les lignes vides et celles qui commencent par # sont ignorées)

pub-video voice check <vidéo> [--rate 5.2]
    Chaque réplique tient-elle dans sa scène ? Débit en syllabes par seconde (5,2 = posé et clair, 6 = rapide).
    « serré » : la réplique remplit plus de 88 % de sa place (elle passe, sans respiration) ; « TROP LONG » : plus de 100 %.
pub-video voice guide <vidéo>
    Écrit exports/<vidéo>_voix-off.srt (sous-titres) et exports/<vidéo>_guide-voix.mp4 : la pub en petit, avec un
    décompte puis chaque réplique affichée au moment de la dire. À regarder au casque pendant l'enregistrement.
pub-video voice mix <vidéo> <prise.wav> | <prise1> <prise2> …  [--cuts t1,t2,…] [--lead 0.06] [--max-tempo 1.12]
    Une prise par réplique (dans l'ordre), ou une seule prise de tout le script avec une pause entre les répliques.
    Nettoie chaque prise, la pose sur sa scène, l'accélère un peu si elle déborde, puis refait le mixage et
    exporte exports/<vidéo>-<durée>s_avec-voix.mp4. --cuts donne les secondes de coupe si les pauses ne suffisent pas.`;

// Spoken length: syllables are a steadier measure than words (French: a final silent e is not said).
function syllables(text) {
	let n = 0;
	for (const w of text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
		if (/^\d+$/.test(w)) {
			n += Math.max(1, Math.ceil(w.length * 1.6));
			continue;
		}
		const groups = w.match(/[aeiouyàâäéèêëîïôöùûüœæ]+/g)?.length ?? 1;
		n += Math.max(1, groups - (groups > 1 && /[^aeiouéèêë](e|es|ent)$/.test(w) ? 1 : 0));
	}
	return n;
}

// Read the script and resolve each line to a time window from the page's scenes.
async function script(root, name, meta) {
	const file = join(root, 'audio', 'voix', `${name}.txt`);
	if (!existsSync(file)) throw new Error(`le script manque : écris audio/voix/${name}.txt (format : pub-video voice --help).`);
	const lines = [];
	for (const [i, raw] of (await readFile(file, 'utf8')).split('\n').entries()) {
		const l = raw.trim();
		if (!l || l.startsWith('#')) continue;
		const cut = l.indexOf('|');
		if (cut < 0) throw new Error(`audio/voix/${name}.txt ligne ${i + 1} : il manque « | » entre le moment et le texte.`);
		const [key, text] = [l.slice(0, cut).trim(), l.slice(cut + 1).trim()];
		const secs = /^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/.exec(key);
		let a;
		let z;
		if (secs) [a, z] = [Number(secs[1].replace(',', '.')), Number(secs[2].replace(',', '.'))];
		else {
			const m = /^(.+?)(?:\+(\d+(?:[.,]\d+)?))?$/.exec(key);
			const sc = meta.scenes.find((s) => s.name === m[1].trim());
			if (!sc) throw new Error(`audio/voix/${name}.txt ligne ${i + 1} : aucune scène « ${m[1].trim()} ». Scènes : ${meta.scenes.map((s) => s.name).join(', ')}.`);
			a = sc.start + (m[2] ? Number(m[2].replace(',', '.')) : 0);
			z = sc.end;
		}
		lines.push({ a, z, text, syl: syllables(text), words: text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length });
	}
	if (!lines.length) throw new Error(`audio/voix/${name}.txt ne contient aucune réplique.`);
	return lines.sort((p, q) => p.a - q.a);
}

const stamp = (t, sep = ',') => {
	const ms = Math.round(t * 1000);
	const p = (v, n = 2) => String(v).padStart(n, '0');
	return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}${sep}${p(ms % 1000, 3)}`;
};

async function duration(file) {
	return Number((await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])).out.trim());
}
// Speech segments of a recording, from the silences between them.
async function speech(file, gap) {
	const total = await duration(file);
	const level = (await loudness(file)).lufs;
	const r = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', `silencedetect=noise=${Math.max(-55, level - 22).toFixed(0)}dB:d=${gap}`, '-f', 'null', '-']);
	const starts = [...r.err.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Math.max(0, Number(m[1])));
	const ends = [...r.err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
	const segs = [];
	let t = 0;
	starts.forEach((s, i) => {
		if (s - t > 0.25) segs.push([t, s]);
		t = ends[i] ?? total;
	});
	if (total - t > 0.25) segs.push([t, total]);
	return segs;
}

export default async function (_cmd, a) {
	const sub = a._[0];
	if (a.help || !sub) return console.log(HELP);
	const root = projectRoot();
	const { name } = videoFile(root, a._[1]);
	const page = await openVideo(root, name);
	const meta = page.meta;
	await page.close();
	const lines = await script(root, name, meta);
	const rate = num(a.rate, 5.2);

	if (sub === 'check') {
		let over = 0;
		console.log(`${pad('scène', 14)}${pad('place', 8)}${pad('dit en', 8)}${pad('rempli', 8)}texte`);
		for (const l of lines) {
			const need = l.syl / rate;
			const fill = need / (l.z - l.a);
			if (fill > 1) over++;
			console.log(`${pad(`${fmt(l.a, 1)}–${fmt(l.z, 1)} s`, 14)}${pad(`${fmt(l.z - l.a, 1)} s`, 8)}${pad(`${fmt(need, 1)} s`, 8)}${pad(`${Math.round(fill * 100)} %`, 8)}${fill > 1 ? 'TROP LONG  ' : fill > 0.88 ? 'serré  ' : ''}${l.text}`);
		}
		const words = lines.reduce((s, l) => s + l.words, 0);
		console.log(`\n${words} mots, ${lines.reduce((s, l) => s + l.syl, 0)} syllabes pour ${fmt(meta.duration, 1)} s (${Math.round((words / meta.duration) * 60)} mots par minute sur toute la pub).`);
		if (over) {
			console.log(`${over} réplique(s) ne tiennent pas dans leur scène à ${rate} syllabes par seconde : raccourcis-les.`);
			process.exit(1);
		}
		return;
	}

	await mkdir(join(root, 'exports'), { recursive: true });
	if (sub === 'guide') {
		const srt = join(root, 'exports', `${name}_voix-off.srt`);
		await writeFile(srt, lines.map((l, i) => `${i + 1}\n${stamp(l.a)} --> ${stamp(Math.min(l.z, lines[i + 1]?.a ?? l.z))}\n${l.text}\n`).join('\n'));
		console.log(`  sous-titres → ${srt}`);
		const dur = Number.isInteger(meta.duration) ? String(meta.duration) : fmt(meta.duration, 1);
		const src = [join(root, 'exports', `${name}-${dur}s_sans-voix.mp4`), join(root, 'render', `${name}_apercu.mp4`)].find(existsSync);
		if (!src) throw new Error(`aucun rendu de « ${name} » : lance d'abord « pub-video preview ${name} » ou « pub-video build ${name} ».`);
		// Subtitles for the guide: a 3 s countdown showing the first line, then each line while it is said,
		// with the next one announced underneath.
		const LEAD = 3;
		const [w, h] = meta.w > meta.h ? [960, Math.round((960 * meta.h) / meta.w / 2) * 2] : [540, Math.round((540 * meta.h) / meta.w / 2) * 2];
		const esc = (t) => t.replace(/\n/g, ' ').replace(/[{}]/g, '');
		const ev = (a0, z0, style, text) => `Dialogue: 0,${stamp(a0, '.').slice(1, -1)},${stamp(z0, '.').slice(1, -1)},${style},,0,0,0,,${text}`;
		const events = [];
		for (let k = 0; k < LEAD; k++) events.push(ev(k, k + 1, 'Count', String(LEAD - k)));
		events.push(ev(0, LEAD, 'Next', `D’abord : ${esc(lines[0].text)}`));
		lines.forEach((l, i) => {
			events.push(ev(LEAD + l.a, LEAD + Math.min(l.z, lines[i + 1]?.a ?? l.z), 'Line', esc(l.text)));
			if (lines[i + 1]) events.push(ev(LEAD + l.a, LEAD + lines[i + 1].a, 'Next', `Ensuite : ${esc(lines[i + 1].text)}`));
		});
		const fs = Math.round(h * 0.036);
		const ass = join(root, 'render', `${name}_guide.ass`);
		await writeFile(ass, `[Script Info]\nScriptType: v4.00+\nPlayResX: ${w}\nPlayResY: ${h}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV\nStyle: Line,DejaVu Sans,${fs},&H00FFFFFF,&H00000000,&HC0000000,1,3,6,0,2,24,24,${Math.round(h * 0.2)}\nStyle: Next,DejaVu Sans,${Math.round(fs * 0.62)},&H0080E8FF,&H00000000,&HC0000000,0,3,4,0,2,24,24,${Math.round(h * 0.07)}\nStyle: Count,DejaVu Sans,${fs * 5},&H00FFFFFF,&H00000000,&H00000000,1,1,4,0,5,0,0,0\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${events.join('\n')}\n`);
		const out = join(root, 'exports', `${name}_guide-voix.mp4`);
		await ffmpeg(['-i', src, '-filter_complex', `[0:v]scale=${w}:${h},tpad=start_duration=${LEAD}:color=black,ass='${ass.replace(/[\\:']/g, '\\$&')}'[v];[0:a]adelay=${LEAD * 1000}:all=1,volume=-8dB[a]`, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
		console.log(`  guide d'enregistrement → ${out}`);
		return;
	}

	if (sub === 'mix') {
		const files = a._.slice(2);
		if (!files.length) throw new Error('donne la ou les prises : pub-video voice mix <vidéo> <prise.wav> …');
		for (const f of files) if (!existsSync(f)) throw new Error(`fichier introuvable : ${f}`);
		// Which stretch of which file holds each line.
		let takes;
		if (files.length === lines.length) takes = files.map((f) => ({ file: f }));
		else if (files.length === 1) {
			let segs = null;
			if (a.cuts) {
				const total = await duration(files[0]);
				const c = [0, ...String(a.cuts).split(',').map(Number), total];
				segs = c.slice(1).map((t, i) => [c[i], t]);
			} else {
				for (const gap of [0.6, 0.45, 0.35, 0.25, 0.8, 1.1]) {
					const s = await speech(files[0], gap);
					if (s.length === lines.length) {
						segs = s;
						break;
					}
					segs ??= s;
				}
			}
			if (segs.length !== lines.length) throw new Error(`la prise contient ${segs.length} passage(s) parlé(s) pour ${lines.length} répliques :\n${segs.map(([p, q], i) => `  ${i + 1}. de ${fmt(p, 1)} à ${fmt(q, 1)} s`).join('\n')}\nRéenregistre avec une vraie pause entre les répliques, donne une prise par réplique, ou indique les coupes : --cuts 3.2,7.9,…`);
			takes = segs.map(([p, q]) => ({ file: files[0], from: Math.max(0, p - 0.08), to: q + 0.12 }));
		} else throw new Error(`${files.length} fichiers pour ${lines.length} répliques : donne une prise par réplique, ou une seule prise de tout le script.`);

		const dir = join(root, 'audio', 'voix');
		const lead = num(a.lead, 0.06);
		const maxTempo = num(a['max-tempo'], 1.12);
		const placed = [];
		console.log(`${pad('scène', 14)}${pad('prise', 8)}${pad('tempo', 8)}${pad('reste', 9)}texte`);
		for (const [i, l] of lines.entries()) {
			const t = takes[i];
			const raw = join(dir, `${name}-${String(i + 1).padStart(2, '0')}.raw.wav`);
			const out = join(dir, `${name}-${String(i + 1).padStart(2, '0')}.wav`);
			// Clean: trim the silence at both ends, remove rumble, even out the level.
			const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_duration=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_duration=0.05,areverse';
			await ffmpeg([...(t.from !== undefined ? ['-ss', String(t.from), '-to', String(t.to)] : []), '-i', t.file, '-af', `highpass=f=85,${trim},acompressor=threshold=-22dB:ratio=3:attack=8:release=140`, '-ac', '1', '-ar', '48000', raw]);
			const d = await duration(raw);
			const room = (lines[i + 1]?.a ?? meta.duration) - l.a - lead - 0.1;
			const tempo = d > room ? Math.min(maxTempo, d / room) : 1;
			const lv = await loudness(raw);
			const gain = Number.isFinite(lv.lufs) ? Math.max(-12, Math.min(18, -17 - lv.lufs)) : 0;
			await ffmpeg(['-i', raw, '-af', `${tempo > 1.005 ? `atempo=${tempo.toFixed(3)},` : ''}volume=${gain.toFixed(1)}dB,alimiter=limit=0.8:level=disabled,afade=t=in:d=0.01,areverse,afade=t=in:d=0.03,areverse`, out]);
			await run('rm', ['-f', raw]);
			const left = room - d / tempo;
			placed.push({ file: relative(root, out), at: Math.round((l.a + lead) * 1000) / 1000, gain: 1 });
			console.log(`${pad(`${fmt(l.a, 1)}–${fmt(l.z, 1)} s`, 14)}${pad(`${fmt(d, 1)} s`, 8)}${pad(tempo > 1.005 ? `×${fmt(tempo, 2)}` : '—', 8)}${pad(left < 0 ? `DÉBORDE ${fmt(-left, 1)} s` : `${fmt(left, 1)} s`, 9)}${l.text.slice(0, 60)}`);
		}
		await writeFile(join(dir, `${name}.json`), JSON.stringify(placed, null, 1));
		console.log(`\n  placement → audio/voix/${name}.json. Mixage et export :`);
		await (await import('./build.mjs')).default('build', { _: [name], 'skip-video': true });
		return;
	}
	throw new Error(`sous-commande inconnue « ${sub} » (check, guide, mix).`);
}
