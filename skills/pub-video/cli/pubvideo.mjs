#!/usr/bin/env node
// pub-video: command-line tools of the pub-video skill. Run `pub-video help` for the list.
import { parseArgs, fail } from './lib/util.mjs';

const COMMANDS = {
	doctor: ['doctor.mjs', 'vérifie les outils installés (ajoute --selftest pour un rendu d’essai)'],
	new: ['new.mjs', 'new <dossier> : crée un projet de pub'],
	capture: ['capture.mjs', 'capture <url…> : captures d’écran en lecture seule + couleurs, polices, textes du site'],
	font: ['font.mjs', 'font "<famille>" : télécharge une police Google Fonts dans assets/fonts'],
	ref: ['ref.mjs', 'ref <url|fichier> : analyse une vidéo de référence (rythme, plans, texte parlé)'],
	music: ['music.mjs', 'music find|scan|fit|licence : cherche, analyse et cale une musique ; relit sa licence'],
	sfx: ['sfxcmd.mjs', 'sfx list|get : bruitages disponibles, ou téléchargement d’un vrai bruitage'],
	stills: ['view.mjs', 'stills <vidéo> <t1,t2,…> : images fixes à ces secondes'],
	sheet: ['view.mjs', 'sheet <vidéo> [--scenes|--transitions|--every 0.5|--times …] : planche de contrôle'],
	check: ['check.mjs', 'check <vidéo> : contrôles automatiques (zones sûres, lisibilité, déterminisme…)'],
	preview: ['build.mjs', 'preview <vidéo> : rendu rapide demi-taille avec le son'],
	build: ['build.mjs', 'build <vidéo> : rendu final, son, mastering, export'],
	voice: ['voice.mjs', 'voice check|guide|mix : durée des répliques, guide d’enregistrement, mixage de la voix'],
	help: [null, 'cette aide']
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
	console.log('pub-video <commande> [options]\n');
	for (const [k, [, d]] of Object.entries(COMMANDS)) console.log(`  ${k.padEnd(9)} ${d}`);
	console.log('\nChaque commande accepte --help. Les commandes de vidéo se lancent depuis le dossier du projet.');
	process.exit(0);
}
if (!COMMANDS[cmd]) fail(`commande inconnue « ${cmd} ». Lance « pub-video help ».`);
const mod = await import(`./lib/${COMMANDS[cmd][0]}`);
try {
	await mod.default(cmd, parseArgs(rest, mod.booleans ?? []), rest);
} catch (e) {
	fail(e.message);
}
