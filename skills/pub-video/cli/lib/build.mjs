// preview and build: page → sound (effects, music, voice) → frames → master → one .mp4, then verify it.
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { projectRoot, videoFile, num, ffmpeg, run, fmt } from './util.mjs';
import { openVideo } from './browser.mjs';
import { renderVideo, reportProblems } from './render.mjs';
import { buildAudio, master } from './audio.mjs';
import { decode } from './dsp.mjs';

export const booleans = ['help', 'no-blur', 'skip-video', 'no-voice'];
const HELP = `pub-video preview <vidéo>
    Rendu rapide (demi-taille, sans flou) avec le son, dans render/<vidéo>_apercu.mp4. Pour juger le rythme.
pub-video build <vidéo> [--samples 8] [--no-blur] [--workers 6] [--skip-video] [--no-voice]
                        [--music-gain 0.8] [--sfx-gain 1.1] [--duck 8] [--lufs -14]
    Rendu final : flou de mouvement (8 sous-images par image), son masterisé, export dans exports/.
    --skip-video : garde les images du dernier rendu et refait seulement le son (après un réglage de mixage).
    --samples 16 : flou plus lisse pour des mouvements très rapides (deux fois plus long).
    Si audio/voix/<vidéo>.json existe (écrit par « pub-video voice mix »), la voix est mixée et la musique baisse sous elle.`;

export async function probe(file) {
	const r = await run('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,color_space,nb_read_frames,sample_rate:format=duration,size', '-of', 'json', file]);
	const j = JSON.parse(r.out);
	const v = j.streams.find((s) => s.codec_type === 'video');
	const a = j.streams.find((s) => s.codec_type === 'audio');
	return { v, a, duration: Number(j.format.duration), size: Number(j.format.size) };
}

export default async function (cmd, a) {
	if (a.help) return console.log(HELP);
	const root = projectRoot();
	const { name } = videoFile(root, a._[0]);
	const preview = cmd === 'preview';
	const page = await openVideo(root, name);
	reportProblems(page, name);
	const meta = page.meta;
	await page.close();
	for (const w of meta.warnings) console.log(`  attention : ${w}`);

	// Sound
	const voiceFile = join(root, 'audio', 'voix', `${name}.json`);
	const voice = !a['no-voice'] && existsSync(voiceFile) ? JSON.parse(readFileSync(voiceFile, 'utf8')).map((c) => ({ ...c, file: join(root, c.file) })) : [];
	const info = await buildAudio(root, name, meta, { voice, musicGain: num(a['music-gain'], 0.8), sfxGain: num(a['sfx-gain'], 1.1), duck: num(a.duck, 8) });
	if (info.unknown.length) throw new Error(`repères son inconnus : ${[...new Set(info.unknown)].join(', ')}. Liste : pub-video sfx list.`);
	const wav = join(root, 'render', `${name}_master.m4a`);
	const m = await master(info.mix, wav, { target: num(a.lufs, -14) });
	console.log(`  son : ${info.cues} bruitages${info.replaced.length ? ` (enregistrements réels : ${info.replaced.join(', ')})` : ''}, ${meta.music?.src ? 'musique' : 'sans musique'}${voice.length ? `, ${voice.length} prise(s) de voix` : ''}`);
	if (info.musicShort) console.log(`  attention : la musique s'arrête à ${fmt(info.musicShort, 1)} s, avant la fin de la vidéo.`);
	if (info.musicDb !== null) console.log(`  niveaux moyens : musique ${fmt(info.musicDb, 1)} dB, bruitages ${fmt(info.sfxDb, 1)} dB`);
	// The drop must still be heard once the effects are on top: compare its lift in the music alone and in the mix.
	const dropAt = meta.music?.drop ?? meta.music?.intro?.until;
	if (dropAt && dropAt < meta.duration - 2) {
		const span = (2 * 60) / meta.bpm; // two beats on each side
		const lift = async (file) => {
			const { L } = await decode(file, { sr: 22050, mono: true });
			const level = (a, z) => {
				let e = 0;
				const [i, j] = [Math.max(0, Math.round(a * 22050)), Math.min(L.length, Math.round(z * 22050))];
				for (let k = i; k < j; k++) e += L[k] * L[k];
				return 10 * Math.log10(e / Math.max(1, j - i) + 1e-12);
			};
			return level(dropAt, dropAt + span) - level(dropAt - span, dropAt);
		};
		const [inMusic, inMix] = [await lift(join(root, 'render', `${name}_music.wav`)), await lift(info.mix)];
		if (inMusic >= 6 && inMix < 3) console.log(`  attention : le drop de ${fmt(dropAt, 2)} s s'entend à peine. La musique y monte de ${fmt(inMusic, 1)} dB, le mixage de ${fmt(inMix, 1)} dB seulement : les bruitages des deux temps d'avant le couvrent. Baisse leur volume (option v des repères) ou supprimes-en.`);
		else console.log(`  drop à ${fmt(dropAt, 2)} s : la musique monte de ${fmt(inMusic, 1)} dB, le mixage de ${fmt(inMix, 1)} dB.`);
	}

	// Picture
	const video = join(root, 'render', preview ? `${name}_apercu_video.mp4` : `${name}_video.mp4`);
	if (a['skip-video'] && existsSync(video)) console.log('  images : rendu précédent conservé');
	else if (preview) await renderVideo(root, name, { out: video, scale: 0.5, samples: 1, crf: 26, preset: 'veryfast', workers: a.workers ? num(a.workers) : undefined });
	else await renderVideo(root, name, { out: video, samples: a['no-blur'] ? 1 : num(a.samples, 8), workers: a.workers ? num(a.workers) : undefined });

	// One file
	const dur = Number.isInteger(meta.duration) ? String(meta.duration) : fmt(meta.duration, 1);
	await mkdir(join(root, 'exports'), { recursive: true });
	const out = preview ? join(root, 'render', `${name}_apercu.mp4`) : join(root, 'exports', `${name}-${dur}s_${voice.length ? 'avec-voix' : 'sans-voix'}.mp4`);
	// No -shortest: the AAC track can end a fraction of a frame early, and it would cut the last image.
	await ffmpeg(['-i', video, '-i', wav, '-map', '0:v', '-map', '1:a', '-c', 'copy', '-movflags', '+faststart', out]);

	// Verify what was written
	const p = await probe(out);
	const frames = Number(p.v.nb_read_frames);
	const bad = [];
	if (frames !== Math.round(meta.duration * meta.fps)) bad.push(`${frames} images au lieu de ${Math.round(meta.duration * meta.fps)}`);
	if (!preview && (p.v.width !== meta.w || p.v.height !== meta.h)) bad.push(`taille ${p.v.width}×${p.v.height} au lieu de ${meta.w}×${meta.h}`);
	if (p.v.pix_fmt !== 'yuv420p' || p.v.color_space !== 'bt709') bad.push(`format ${p.v.pix_fmt}/${p.v.color_space} au lieu de yuv420p/bt709`);
	if (!p.a) bad.push('pas de piste son');
	if (Math.abs(m.after.lufs - num(a.lufs, -14)) > 1) console.log(`  attention : niveau ${m.after.lufs} LUFS, loin de la cible. Le son est trop clairsemé pour l'atteindre sans l'écraser.`);
	if (m.after.peak > -0.8) bad.push(`crête ${m.after.peak} dB, au-dessus de -1 dB`);
	console.log(`  ${p.v.width}×${p.v.height}, ${frames} images à ${meta.fps} i/s, ${fmt(p.duration, 2)} s, ${fmt(p.size / 1e6, 1)} Mo`);
	console.log(`  niveau sonore : ${m.after.lufs} LUFS, crête ${m.after.peak} dB (mixage à ${m.before.lufs} LUFS, gain ${fmt(m.gain, 1)} dB)`);
	if (bad.length) throw new Error(`export incorrect : ${bad.join(' ; ')}`);
	console.log(`  → ${out}`);
}
