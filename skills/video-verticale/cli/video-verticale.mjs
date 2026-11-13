#!/usr/bin/env node
// video-verticale: command-line tools of the video-verticale skill. Run `video-verticale help` for the list.
import { parseArgs, fail } from './lib/util.mjs';

const COMMANDS = {
	doctor: ['doctor.mjs', 'vérifie les outils installés et les skills frères'],
	new: ['new.mjs', 'new <dossier> <source> : crée un projet d’habillage (source = montage-youtube ou vidéo)'],
	mots: ['new.mjs', 'mots : relit les mots de la source'],
	police: ['police.mjs', 'police "<famille>" : police des sous-titres (Google Fonts, TTF)'],
	apercu: ['render.mjs', 'apercu : rendu rapide 540×960'],
	build: ['render.mjs', 'build : export final 1080×1920'],
	planche: ['view.mjs', 'planche [--every 1] : planche d’images du rendu'],
	image: ['view.mjs', 'image <secondes> : couverture pleine taille'],
	check: ['check.mjs', 'check : contrôles (format, durée, niveau, zone sûre, police, accroche)'],
	help: [null, 'cette aide']
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
	console.log('video-verticale <commande> [options]\n');
	for (const [k, [, d]] of Object.entries(COMMANDS)) console.log(`  ${k.padEnd(8)} ${d}`);
	console.log('\nChaque commande accepte --help. Après « new », les commandes se lancent depuis le dossier du projet.');
	process.exit(0);
}
if (!COMMANDS[cmd]) fail(`commande inconnue « ${cmd} ». Lance « video-verticale help ».`);
const mod = await import(`./lib/${COMMANDS[cmd][0]}`);
try {
	await mod.default(cmd, parseArgs(rest, mod.booleans ?? []), rest);
} catch (e) {
	fail(e.message);
}
