// Serveur local de pilote : garde le navigateur ouvert et exécute les commandes une par une.
// Écoute seulement sur 127.0.0.1, avec un jeton aléatoire écrit dans .local/pilote/session.json.

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Pilote } from './actions.mjs';

const DOSSIER = join(process.cwd(), '.local', 'pilote');
const SESSION = join(DOSSIER, 'session.json');
const INACTIF_MS = 30 * 60 * 1000;
const jeton = randomBytes(16).toString('hex');
const pilote = new Pilote(DOSSIER);

let minuteur;
const armer = () => {
	clearTimeout(minuteur);
	minuteur = setTimeout(arreter, INACTIF_MS);
};

async function arreter() {
	await pilote.fermer().catch(() => {});
	await rm(SESSION, { force: true });
	process.exit(0);
}

// Une commande à la fois : la suivante attend la fin de la précédente.
let file = Promise.resolve();

const serveur = createServer((req, res) => {
	if (req.headers.authorization !== `Bearer ${jeton}`) {
		res.writeHead(403).end();
		return;
	}
	if (req.url === '/ping') {
		res.writeHead(200).end('ok');
		return;
	}
	let corps = '';
	req.on('data', (c) => (corps += c));
	req.on('end', () => {
		armer();
		file = file.then(async () => {
			let rep;
			try {
				const { argv } = JSON.parse(corps);
				rep = { texte: await pilote.executer(argv) };
			} catch (e) {
				rep = { erreur: e.message.split('\n')[0] };
			}
			res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(rep));
			if (pilote.fini) setTimeout(arreter, 50);
		});
	});
});

serveur.listen(0, '127.0.0.1', async () => {
	await mkdir(DOSSIER, { recursive: true });
	await writeFile(SESSION, JSON.stringify({ port: serveur.address().port, jeton, pid: process.pid, version: process.env.PILOTE_VERSION }), { mode: 0o600 });
	armer();
});

process.on('SIGTERM', arreter);
process.on('SIGINT', arreter);
