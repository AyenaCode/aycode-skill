// plan: check script.md and show the timeline it gives, line by line, before anything is rendered.
import { loadScript } from './script.mjs';
import { buildTimeline } from './timeline.mjs';
import { chapterTime, dur, fmt, loadConfig, pad, projectRoot, tc, wordsOf } from './util.mjs';

export const booleans = ['help', 'court'];
const HELP = `refonte-youtube plan [--court]
    Lit script.md, place chaque réplique sur la timeline et affiche, réplique par réplique : début, durée,
    ce qui est à l'écran et comment il remplit la réplique (coupé, ralenti, accéléré, image tenue), et les alertes.
    Sans prise de voix, la durée d'une réplique est estimée sur son texte (marquée ~).
    Puis le bilan : durée totale, chapitres (à coller dans la description YouTube), débit, part de l'ancienne vidéo reprise.
    --court : seulement les alertes et le bilan. Code de sortie 1 s'il reste une erreur.`;

function picture(it) {
	const v = it.line.visual;
	if (v.kind === 'motion') return `motion ${v.file.replace(/^motion\//, '').replace(/\.mp4$/, '')}`;
	if (v.kind === 'image') return `image ${v.file}`;
	if (v.kind === 'carton') return `carton « ${String(it.carton ?? '').slice(0, 24)} »`;
	const how = !it.fit ? '' : it.fit.k > 1.01 ? ` ×${fmt(it.fit.k, 2)}` : it.fit.k < 0.99 ? ` ralenti ×${fmt(it.fit.k, 2)}` : '';
	const hold = it.fit?.hold > 0.05 ? ` +tenue ${fmt(it.fit.hold)} s` : '';
	const from = v.file ? `${v.file.split('/').pop()} ` : '';
	return `${from}${it.pieces.map((p) => `${tc(p.ss)}→${tc(p.ss + p.len)}`).join(' + ')}${how}${hold}${it.pieces.some((p) => p.zoom && !p.zoom.auto) ? ' zoom' : ''}`;
}

export default async function (_cmd, a) {
	if (a.help) return console.log(HELP);
	const root = projectRoot();
	const cfg = loadConfig(root);
	const { lines, errors } = loadScript(root);
	if (errors.length) {
		console.log(`script.md à corriger :\n  ${errors.join('\n  ')}`);
		process.exit(1);
	}
	const tl = await buildTimeline(root, cfg, lines, { estimate: true });
	if (!a.court) {
		console.log(`${pad('n°', 5)}${pad('début', 10)}${pad('durée', 8)}${pad('voix', 8)}${pad('à l’écran', 46)}texte`);
		for (const it of tl.items) {
			if (it.chapter) console.log(`\n# ${it.chapter}  (${chapterTime(it.start)})`);
			const voice = it.voice ? `${it.voice.estimated ? '~' : ''}${fmt(it.voice.dur)} s` : '—';
			console.log(`${pad(it.n, 5)}${pad(tc(it.start), 10)}${pad(`${fmt(it.end - it.start)} s`, 8)}${pad(voice, 8)}${pad(picture(it).slice(0, 44), 46)}${it.line.text.slice(0, 60)}`);
			for (const n of it.notes) console.log(`${' '.repeat(31)}↳ ${n}`);
		}
	}
	const voiced = tl.items.filter((it) => it.voice);
	const missing = voiced.filter((it) => it.voice.estimated).length;
	const words = voiced.reduce((s, it) => s + wordsOf(it.line.text).length, 0);
	const speech = voiced.reduce((s, it) => s + it.voice.dur, 0);
	const reused = tl.items.flatMap((it) => it.pieces).filter((p) => p.kind === 'source' && p.file === cfg.source?.video).reduce((s, p) => s + p.len, 0);
	const clips = tl.items.flatMap((it) => it.pieces).filter((p) => p.kind === 'source' && p.file !== cfg.source?.video).reduce((s, p) => s + p.len, 0);
	const images = tl.items.filter((it) => it.line.visual.kind === 'image').length;
	console.log(`\nDurée : ${dur(tl.duration)}${missing ? ` (estimée : ${missing} réplique(s) sans prise de voix)` : ''} · ${tl.items.length} répliques · ${tl.chapters.length} chapitre(s)`);
	console.log(`Voix : ${words} mots, ${speech ? Math.round((words / speech) * 60) : 0} mots par minute parlée, ${Math.round((speech / Math.max(1, tl.duration)) * 100)} % du temps`);
	console.log(`${cfg.source ? `Ancienne vidéo reprise : ${dur(reused)} sur ${dur(cfg.source.duree)} · ` : ''}clips : ${dur(clips)} · images : ${images} · séquences animées : ${tl.items.filter((it) => it.line.visual.kind === 'motion').length} · cartons : ${tl.items.filter((it) => it.line.visual.kind === 'carton').length} · mots forts : ${tl.items.reduce((s, it) => s + it.keywords.length, 0)}`);
	if (cfg.duree_visee) {
		const gap = tl.duration / cfg.duree_visee - 1;
		console.log(`Durée visée : ${dur(cfg.duree_visee)} → ${gap >= 0 ? '+' : ''}${Math.round(gap * 100)} %${Math.abs(gap) > 0.1 ? ' (hors des 10 %)' : ''}`);
	}
	if (tl.chapters.length) {
		console.log('\nChapitres :');
		for (const c of tl.chapters) console.log(`  ${chapterTime(c.at)} ${c.title}`);
	}
	if (tl.warnings.length) console.log(`\nAlertes (${tl.warnings.length}) :\n  ${tl.warnings.join('\n  ')}`);
	if (tl.errors.length) {
		console.log(`\nErreurs (${tl.errors.length}) :\n  ${tl.errors.join('\n  ')}`);
		process.exitCode = 1;
	} else console.log('\nOK : aucune erreur.');
}
