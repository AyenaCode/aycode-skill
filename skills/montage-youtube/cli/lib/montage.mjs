// montage.md: the cut list, written by `analyse`, edited by the agent, read by every later command.
import { basename } from 'node:path';
import { fmt, num, tc } from './util.mjs';

export const itemsText = (p, struck) => p.items.map((it, i) => (struck.has(i) ? `~~${it.t}~~` : it.t)).join(' ');

export function montageText(an, proj) {
	const R = proj.reglages;
	const mode = R.mode === 'auto' ? an.mode : R.mode;
	const out = [
		`# Montage : ${proj.nom}`,
		'',
		`> Mode **${mode === 'ecran' ? 'écran' : 'visage'}**${R.mode === 'auto' ? ' (détecté)' : ''} · transcription ${an.model}${an.dtw ? '' : ' (horodatage approximatif)'} · langue ${an.lang}`,
		'>',
		'> `[x]` garder la phrase · `[ ]` la couper · `~~mots~~` couper des mots dans une phrase.',
		`> \`⏸\` pause après la phrase. Par défaut, une pause de plus de ${fmt(R.pauseMax)} s est ramenée à ${fmt(R.pause)} s${mode === 'ecran' ? ', plus les moments où l’écran bouge' : ''}.`,
		'> Pour décider autrement, termine la ligne par « → 0,8 s » ou « → garder ».',
		'> `(euh?)` : courte voix isolée, sans mot : coupée par défaut · `(son)` : son sans mot, gardé par défaut.',
		'> `(paroles?)` : voix que la transcription n’a pas écrite, gardée par défaut. Le plus souvent une phrase dite deux fois (la transcription n’en écrit qu’une) : si la phrase d’avant tourne court, c’est une reprise.',
		'> Le texte des phrases reste tel quel : les corrections de mots vont dans les sous-titres.',
		''
	];
	for (const [k, src] of an.sources.entries()) {
		out.push(`## Rush ${k + 1} · ${basename(src.file)} · ${tc(src.duration)}`, '');
		for (const p of an.phrases.filter((q) => q.src === k)) {
			out.push(`${p.id} [${p.keep ? 'x' : ' '}] ${tc(p.a)}  ${itemsText(p, new Set(p.strike))}${p.note ? `   # ${p.note}` : ''}`);
			const pause = an.pauses[p.id];
			if (pause && pause.b - pause.a >= 0.3) out.push(`   ⏸ ${fmt(pause.b - pause.a)} s${mode === 'ecran' && pause.move >= 0.2 ? ` · l’écran bouge ${fmt(pause.move)} s` : ''}`);
		}
		out.push('');
	}
	if (an.ignored.length) {
		out.push('## Texte ignoré', '', '> Mots transcrits là où il n’y a pas de voix (souvent inventés par la transcription). Ils ne sont ni gardés ni coupés.', '');
		for (const w of an.ignored) out.push(`- rush ${w.src + 1}, ${tc(w.a)} : ${w.t}`);
		out.push('');
	}
	return out.join('\n');
}

// Decisions read back from montage.md: kept phrases, struck words, pause targets. Errors name the line to fix.
export function parseMontage(text, an) {
	const byId = new Map(an.phrases.map((p) => [p.id, p]));
	const keep = new Map();
	const strike = new Map();
	const pause = new Map();
	const errors = [];
	let last = null;
	for (const [ln, line] of text.split('\n').entries()) {
		let m = /^(P\d+)\s+\[([ xX])\]\s+\S+\s*(.*)$/.exec(line);
		if (m) {
			const p = byId.get(m[1]);
			if (!p) {
				errors.push(`ligne ${ln + 1} : ${m[1]} n’existe pas dans l’analyse.`);
				continue;
			}
			last = p;
			keep.set(p.id, m[2] !== ' ');
			const body = m[3].split(/\s+#\s/)[0].trim();
			const toks = body ? body.split(/\s+/) : [];
			const struck = new Set();
			let open = false;
			let ok = toks.length === p.items.length;
			toks.forEach((tok, i) => {
				let t = tok;
				let s = open;
				if (t.startsWith('~~')) {
					s = open = true;
					t = t.slice(2);
				}
				if (t.endsWith('~~')) {
					t = t.slice(0, -2);
					open = false;
				}
				if (s) struck.add(i);
				if (t !== p.items[i]?.t) ok = false;
			});
			if (!ok) errors.push(`${p.id} (ligne ${ln + 1}) : le texte ne correspond plus à la transcription. Remets-le tel quel et marque seulement les coupes : ${itemsText(p, new Set())}`);
			strike.set(p.id, struck);
			continue;
		}
		m = /^\s*⏸\s*([\d,.]+)\s*s\b(.*)$/.exec(line);
		if (m && last) {
			const arrow = /→\s*(garder|[\d,.]+)/i.exec(m[2]);
			if (arrow) pause.set(last.id, /garder/i.test(arrow[1]) ? 'garder' : num(arrow[1]));
		}
	}
	for (const p of an.phrases) {
		if (!keep.has(p.id)) errors.push(`${p.id} manque dans montage.md (${tc(p.a)} « ${itemsText(p, new Set()).slice(0, 50)} ») : remets sa ligne, avec [ ] pour la couper.`);
	}
	return { keep, strike, pause, errors };
}
