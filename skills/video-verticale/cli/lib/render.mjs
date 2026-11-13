// apercu / build: frame the video in 9:16, punch in on the cuts, burn the captions, mix music and sound
// effects under the voice, and export the .mp4.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildAss } from './ass.mjs';
import { pub } from './freres.mjs';
import { checkFont } from './police.mjs';
import { dur, ffmpeg, fmt, loadConfig, loadWords, loudness, probe, projectRoot, rateOf, run, writeJson } from './util.mjs';

export const booleans = ['help'];
const HELP = `video-verticale apercu   aperçu rapide (540×960) → exports/<nom>_apercu.mp4
video-verticale build    export final (1080×1920) → exports/<nom>.mp4
    Recadre en 9:16, zoome aux instants de verticale.json (zooms), incruste sous-titres et titre d'accroche,
    mixe musique et bruitages sous la voix (la musique baisse quand la voix parle), règle le tout à -14 LUFS.
    Sans musique ni bruitage, le son de la source est gardé tel quel.
    Contrôle à la fin : nombre d'images, synchronisation image/son, niveau.`;

export default async function (cmd, a) {
	if (a.help) return console.log(HELP);
	const final = cmd === 'build';
	const kind = final ? 'final' : 'apercu';
	const root = projectRoot();
	const cfg = loadConfig(root);
	const words = loadWords(root);
	const video = cfg.source.video;
	if (statSync(video).mtimeMs !== words.mtime) console.log('Attention : la source a changé depuis la lecture des mots. Lance « video-verticale mots » pour que les sous-titres tombent juste.');
	const src = await probe(video);
	const F = rateOf(cfg.sortie.rate);
	const { width: W, height: H } = cfg.sortie;
	const t0 = Date.now();

	// 1. Captions and hook title.
	const ass = buildAss(cfg, words.words);
	if (ass.events) {
		const c = await checkFont(root, cfg);
		if (!c.ok) throw new Error(c.why);
		await writeFile(join(root, 'work', 'sous-titres.ass'), ass.text);
	}

	// 2. Sound: the source as it is, or a new mix when there is music or a sound effect.
	const mixed = !!cfg.musique || cfg.bruitages.length > 0;
	const sound = mixed ? await mix(root, cfg, words.duration, kind, !!src.audio) : null;

	// 3. Picture: constant frame rate, cover-scaled and cropped to 9:16, zoom steps, captions.
	const steps = [`fps=${cfg.sortie.rate}`, `scale=${W}:${H}:force_original_aspect_ratio=increase`, `crop=${W}:${H}:x=(iw-ow)*${cfg.sortie.cadrage ?? 0.5}:y=(ih-oh)/2`, 'setsar=1'];
	const z = zoomExpr(cfg.zooms, F);
	if (z) steps.push(`zoompan=z='${z}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${W}x${H}:fps=${cfg.sortie.rate}`);
	if (ass.events) steps.push('ass=filename=work/sous-titres.ass:fontsdir=fonts');
	if (!final) steps.push('scale=540:960');
	steps.push('format=yuv420p');
	const enc = final
		? ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-profile:v', 'high', '-bf', '2', '-g', String(Math.max(1, Math.round(F / 2))), '-pix_fmt', 'yuv420p']
		: ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p'];
	const audio = sound ? ['-map', '1:a', '-c:a', 'copy'] : src.audio ? ['-map', '0:a:0', ...(src.audio === 'aac' ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000'])] : [];
	const out = join(root, 'exports', `${cfg.nom}${final ? '' : '_apercu'}.mp4`);
	console.log(`Rendu ${final ? 'final' : 'de l’aperçu'} : ${ass.events} sous-titre(s), ${cfg.zooms.length} zoom(s), ${mixed ? `musique ${cfg.musique ? 'oui' : 'non'}, ${cfg.bruitages.length} bruitage(s)` : 'son de la source'}…`);
	await ffmpeg(['-i', video, ...(sound ? ['-i', sound.file] : []), '-filter_complex', `[0:v]${steps.join(',')}[v]`, '-map', '[v]', ...audio, ...enc, '-t', words.duration.toFixed(3), '-movflags', '+faststart', out], { cwd: root });

	// 4. Check what was written.
	const pr = JSON.parse((await run('ffprobe', ['-v', 'error', '-count_packets', '-show_entries', 'stream=codec_type,nb_read_packets,duration,width,height', '-of', 'json', out])).out);
	const v = pr.streams.find((s) => s.codec_type === 'video');
	const au = pr.streams.find((s) => s.codec_type === 'audio');
	const frames = Number(v.nb_read_packets);
	const expected = Math.round(words.duration * F);
	const gap = au ? Math.abs(Number(v.duration) - Number(au.duration)) : 0;
	const lv = au ? await loudness(out) : null;
	const ok = Math.abs(frames - expected) <= 1 && gap <= 1 / F + 0.05;
	writeJson(join(root, 'work', `${kind}.json`), { file: out, duration: Number(v.duration), frames, expected, gap, width: v.width, height: v.height, lufs: lv?.lufs ?? null, peak: lv?.peak ?? null, music: sound?.music ?? null, at: new Date().toISOString() });
	console.log(`\n${ok ? 'OK' : 'PROBLÈME'} ${out}`);
	console.log(`  ${dur(Number(v.duration))}, ${frames} images (attendu ${expected}), écart image/son ${fmt(gap * 1000, 0)} ms, ${v.width}×${v.height}`);
	const db = (x) => (Number.isFinite(x) ? fmt(x) : '-∞');
	if (lv) console.log(`  son : ${db(lv.lufs)} LUFS, crête ${db(lv.peak)} dB${sound?.music !== undefined && sound.music !== null ? `, musique ${fmt(sound.music)} LU sous la voix` : ''} · rendu en ${dur((Date.now() - t0) / 1000)}`);
	else console.log('  sans son.');
	if (!ok) throw new Error('le fichier exporté ne correspond pas à la source (nombre d’images ou synchronisation).');
}

// Zoom steps → a zoompan expression on the input time. Each step starts on a frame boundary and is
// compared half a frame early, so the change lands exactly on the cut frame.
export function zoomExpr(zooms = [], F) {
	const s = [...zooms].sort((x, y) => x.t - y.t).map((z) => ({ t: Math.round(z.t * F) / F, z: Number(z.z) }));
	const half = 0.5 / F;
	const terms = s
		.map((z, i) => {
			if (!(z.z > 1)) return null;
			const a = (z.t - half).toFixed(4);
			const b = i + 1 < s.length ? (s[i + 1].t - half).toFixed(4) : '1e9';
			return `${(z.z - 1).toFixed(4)}*gte(it,${a})*lt(it,${b})`;
		})
		.filter(Boolean);
	return terms.length ? `1+${terms.join('+')}` : null;
}

// Music bed and sound effects under the voice, with pub-video's mixer: the music drops by `baisse` dB
// while the voice speaks. Then one gain to the target loudness and a peak limiter.
async function mix(root, cfg, duration, kind, hasVoice) {
	const { buildAudio, master } = await pub.audio();
	const { FX } = await pub.sfx();
	const dir = join(root, 'audio', 'sfx');
	const real = existsSync(dir) ? readdirSync(dir).map((f) => f.replace(/\.[^.]+$/, '')) : [];
	const unknown = [...new Set(cfg.bruitages.filter((c) => !FX[c.type] && !real.includes(c.type)).map((c) => c.type))];
	if (unknown.length) throw new Error(`bruitage inconnu : ${unknown.join(', ')}. La liste : « pub-video sfx list ».`);
	const late = cfg.bruitages.filter((c) => !(c.t >= 0 && c.t < duration));
	if (late.length) throw new Error(`bruitage hors de la vidéo (0 à ${fmt(duration)} s) : ${late.map((c) => `${c.type} à ${c.t}`).join(', ')}.`);
	const m = cfg.musique;
	const music = m ? { src: resolve(root, m.fichier), start: m.debut ?? 0, gain: m.gain ?? 0.6, fadeIn: m.fondu_entree ?? 0.08, fadeOut: m.fondu_sortie ?? 1.2 } : null;
	if (music && !existsSync(music.src)) throw new Error(`musique introuvable : ${m.fichier}`);
	const info = await buildAudio(root, kind, { duration, cues: cfg.bruitages.map((c) => ({ ...c })), music }, { voice: hasVoice ? [{ file: cfg.source.video, at: 0 }] : [], musicGain: 1, sfxGain: 1, duck: cfg.mixage.baisse ?? 8 });
	if (info.musicShort) console.log(`  attention : la musique s’arrête à ${fmt(info.musicShort)} s, avant la fin de la vidéo.`);
	const file = join(root, 'work', `${kind}-son.m4a`);
	await master(info.mix, file, { target: cfg.mixage.lufs ?? -14, ceiling: -1.5 });
	// How far the music sits under the voice, measured on the two buses.
	let under = null;
	if (music && hasVoice) {
		const vo = await loudness(join(root, 'render', `${kind}_voice.wav`));
		const mu = await loudness(join(root, 'render', `${kind}_music.wav`));
		if (Number.isFinite(vo.lufs) && Number.isFinite(mu.lufs)) under = vo.lufs - mu.lufs;
	}
	return { file, music: under };
}
