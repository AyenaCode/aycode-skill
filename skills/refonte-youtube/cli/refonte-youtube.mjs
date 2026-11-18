#!/usr/bin/env node
// refonte-youtube: command-line tools of the refonte-youtube skill. Run `refonte-youtube help` for the list.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs, fail } from './lib/util.mjs';

const COMMANDS = {
	doctor: ['doctor.mjs', 'vérifie les outils installés'],
	new: ['new.mjs', 'new <dossier> <vidéo|lien> : crée le projet, transcrit l’ancienne vidéo, dessine ses planches'],
	planche: ['planche.mjs', 'planche [--de --a --pas] [--apercu|--final] : images d’un passage, avec leur temps'],
	plan: ['plan.mjs', 'plan : vérifie script.md et affiche la timeline réplique par réplique'],
	voix: ['voix.mjs', 'voix --profil <nom> : dit chaque réplique avec la voix clonée (voicebox)'],
	mots: ['mots.mjs', 'mots : transcrit la voix générée, cale les mots forts, signale les prises ratées'],
	police: ['police.mjs', 'police "<famille>" : police des textes incrustés (Google Fonts)'],
	apercu: ['render.mjs', 'apercu [--estime] : aperçu rapide avec le son'],
	build: ['render.mjs', 'build : export final, sous-titres .srt et chapitres YouTube'],
	help: [null, 'cette aide ; « help script » : la syntaxe de script.md']
};

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'help' && rest[0] === 'script') {
	// The syntax lives in one place: the header comment of script.mjs.
	const src = readFileSync(fileURLToPath(new URL('./lib/script.mjs', import.meta.url)), 'utf8');
	console.log(src.split('\nimport ')[0].replace(/^\/\/ ?/gm, ''));
	process.exit(0);
}
if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
	console.log('refonte-youtube <commande> [options]\n');
	for (const [k, [, d]] of Object.entries(COMMANDS)) console.log(`  ${k.padEnd(8)} ${d}`);
	console.log('\nChaque commande accepte --help. Après « new », les commandes se lancent depuis le dossier du projet.');
	process.exit(0);
}
if (!COMMANDS[cmd]) fail(`commande inconnue « ${cmd} ». Lance « refonte-youtube help ».`);
const mod = await import(`./lib/${COMMANDS[cmd][0]}`);
try {
	await mod.default(cmd, parseArgs(rest, mod.booleans ?? []), rest);
} catch (e) {
	fail(e.message);
}
