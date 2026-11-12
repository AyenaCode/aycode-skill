#!/usr/bin/env node
// montage-youtube: command-line tools of the montage-youtube skill. Run `montage-youtube help` for the list.
import { parseArgs, fail } from './lib/util.mjs';

const COMMANDS = {
	doctor: ['doctor.mjs', 'vérifie les outils installés'],
	new: ['new.mjs', 'new <dossier> <rush…> : crée un projet de montage'],
	ref: ['ref.mjs', 'ref <url|fichier> : mesure le rythme d’une vidéo de référence'],
	analyse: ['analyse.mjs', 'analyse : transcrit, repère pauses et reprises, propose montage.md'],
	plan: ['plan.mjs', 'plan : vérifie montage.md et affiche le bilan des coupes'],
	preview: ['render.mjs', 'preview : aperçu rapide du montage'],
	check: ['check.mjs', 'check : retranscrit l’export et signale les mots coupés ou les restes'],
	build: ['render.mjs', 'build : export final pour YouTube'],
	subs: ['subs.mjs', 'subs [check] : sous-titres .srt du montage, puis leur contrôle'],
	help: [null, 'cette aide']
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
	console.log('montage-youtube <commande> [options]\n');
	for (const [k, [, d]] of Object.entries(COMMANDS)) console.log(`  ${k.padEnd(8)} ${d}`);
	console.log('\nChaque commande accepte --help. Après « new », les commandes se lancent depuis le dossier du projet.');
	process.exit(0);
}
if (!COMMANDS[cmd]) fail(`commande inconnue « ${cmd} ». Lance « montage-youtube help ».`);
const mod = await import(`./lib/${COMMANDS[cmd][0]}`);
try {
	await mod.default(cmd, parseArgs(rest, mod.booleans ?? []), rest);
} catch (e) {
	fail(e.message);
}
