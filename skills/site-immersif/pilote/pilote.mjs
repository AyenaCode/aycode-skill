#!/usr/bin/env node
// pilote : manipule un site comme un visiteur et rend un retour compact (références @eN, captures, planches, mesures).
// Chaque commande est envoyée à un serveur local qui garde le navigateur ouvert entre deux commandes.

import { spawn } from 'node:child_process';
import { readFile, mkdir, open, readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const DOSSIER = join(process.cwd(), '.local', 'pilote');
const SESSION = join(DOSSIER, 'session.json');

const AIDE = `pilote : manipule un site comme un visiteur, avec un retour compact.

Session
  ouvre <url> [--mobile | --bureau] [--visible] [--reduit] [--cpu N] [--chrome] [--attente 20000]
                         ouvre le site (mobile : Pixel 7, processeur ralenti 4x ; bureau : 1440x900).
                         --visible : fenêtre réelle avec la vraie carte graphique (mesures 3D réalistes).
                         --reduit : mode mouvement réduit.
                         --chrome : Google Chrome installé, qui lit les vidéos MP4 (le Chromium de test ne les lit pas).
                         --attente : temps maximal laissé à l'écran de chargement du site pour disparaître (ms).
  ferme                  ferme la session (sinon elle se ferme seule après 30 min d'inactivité)

Voir
  regarde [--tout]       capture + éléments à l'écran (--tout : toute la page) avec leurs références @eN
  capture [--plein]      capture seule (--plein : page entière)
  etat                   adresse, erreurs depuis le dernier état, carte graphique, infos de la scène 3D
  tour [--etapes 6]      planche du haut en bas de la page + fluidité d'un défilement complet
  compare <img> <img>    planche avant / après

Agir (chaque action rend le différentiel des éléments : + apparu, - disparu, et une capture)
  clique <cible>         tape au doigt sur mobile, clic sur bureau
  survole <cible>
  tape <cible> <texte>
  touche <Touche>        Tab, Enter, Escape, ArrowDown... (Tab dit quel élément a le focus et s'il est visible)
  glisse <de> <à> [--duree 600] [--souris | --doigt]
  defile <px> [--vitesse 1200]     défilement réel (molette ou doigt) ; px négatif = vers le haut
  va <y | N% | cible>    saute à une position, sans geste
  incline <beta> <gamma> [--duree 800]   inclinaison du téléphone (deviceorientation)
  attends <ms>

Observer une action
  filme [--images 12] [--apres 600] <action...>   planche d'images prises pendant l'action
  mesure [--apres 500] <action...>                fluidité, réaction, décalages et images longues pendant l'action
  Les actions s'enchaînent avec « puis » : filme clique @e3 puis attends 120 puis clique @e3
  (l'animation est-elle reprise d'où elle est, sans saut, quand on l'interrompt ?)

Accessibilité
  accessibilite          audit axe-core de la page (si axe-core est installé dans le projet), contraste mesuré
                         sur le fond réellement affiché (dégradé, image, vidéo, 3D) et cibles tactiles, à l'écran courant

Analyser un site de référence
  analyse <url> [--mobile] [--visible] [--chrome] [--attente 20000] [--etapes 8]
                         charge le site en l'observant dès le départ, le parcourt, puis relève sa recette :
                         bibliothèques, réglages du scroll, animations (durées, courbes), palette, polices,
                         structure, 3D (appels de dessin, shaders, procédés), interactions écoutées, poids.
                         La session reste sur le site : filme et mesure ses gestes ensuite.

Cibles : @e4 (centre de l'élément), @e4:0.2,0.8 (point relatif dans l'élément, utile sur un canvas), 200,400 (pixels).
Les références viennent de la dernière commande regarde ou du dernier différentiel.
Fichiers : .local/pilote/ dans le dossier courant. Playwright doit être installé dans le projet.`;

const argv = process.argv.slice(2);
if (!argv.length || ['aide', '--help', '-h'].includes(argv[0])) {
	console.log(AIDE);
	process.exit(0);
}

// Version du code de pilote : une session lancée avec un code plus ancien est remplacée.
async function version() {
	const fichiers = (await readdir(ICI)).filter((f) => f.endsWith('.mjs'));
	const dates = await Promise.all(fichiers.map(async (f) => (await stat(join(ICI, f))).mtimeMs));
	return String(Math.max(...dates));
}

async function lireSession() {
	try {
		return JSON.parse(await readFile(SESSION, 'utf8'));
	} catch {
		return null;
	}
}

async function vivante(s) {
	try {
		const r = await fetch(`http://127.0.0.1:${s.port}/ping`, { headers: { authorization: `Bearer ${s.jeton}` } });
		return r.ok;
	} catch {
		return false;
	}
}

async function demarrer() {
	await mkdir(DOSSIER, { recursive: true });
	const log = await open(join(DOSSIER, 'serveur.log'), 'a');
	const enfant = spawn(process.execPath, [join(ICI, 'serveur.mjs')], {
		cwd: process.cwd(),
		env: { ...process.env, PILOTE_VERSION: await version() },
		detached: true,
		stdio: ['ignore', log.fd, log.fd],
	});
	enfant.unref();
	await log.close();
	for (let i = 0; i < 150; i++) {
		await new Promise((r) => setTimeout(r, 100));
		const s = await lireSession();
		if (s && s.pid === enfant.pid && (await vivante(s))) return s;
	}
	throw new Error(`le serveur de pilote ne démarre pas, voir ${join(DOSSIER, 'serveur.log')}`);
}

try {
	let s = await lireSession();
	if (s && (await vivante(s)) && s.version !== (await version())) {
		// pilote a été mis à jour : on ferme l'ancienne session.
		await fetch(`http://127.0.0.1:${s.port}/`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${s.jeton}` }, body: JSON.stringify({ argv: ['ferme'] }) }).catch(() => {});
		await new Promise((r) => setTimeout(r, 300));
		if (!['ouvre', 'analyse', 'ferme'].includes(argv[0])) throw new Error('pilote a été mis à jour : rouvre la session avec « pilote ouvre <url> »');
		s = null;
	}
	if (!s || !(await vivante(s))) {
		if (argv[0] === 'ferme') {
			console.log('aucune session ouverte');
			process.exit(0);
		}
		if (!['ouvre', 'analyse'].includes(argv[0])) throw new Error('aucune session : commence par « pilote ouvre <url> » ou « pilote analyse <url> »');
		s = await demarrer();
	}
	const r = await fetch(`http://127.0.0.1:${s.port}/`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${s.jeton}` },
		body: JSON.stringify({ argv }),
	});
	const rep = await r.json();
	if (rep.texte) console.log(rep.texte);
	if (rep.erreur) throw new Error(rep.erreur);
} catch (e) {
	console.error(`erreur : ${e.message}`);
	process.exit(1);
}
