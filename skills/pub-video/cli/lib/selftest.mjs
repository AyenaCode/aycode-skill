// Self-test: render the bundled demo at half size and check that a valid file comes out.
import { cp, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SKILL } from './util.mjs';

export default async function () {
	// A fresh folder in the system's temporary directory; it is left there for the system to clean up.
	const dir = await mkdtemp(join(tmpdir(), 'pub-video-'));
	await cp(join(SKILL, 'demo'), dir, { recursive: true, filter: (src) => !/\/(render|exports)(\/|$)/.test(src) });
	const cwd = process.cwd();
	process.chdir(dir);
	try {
		console.log('\nRendu d’essai de la démo (demi-taille) :');
		await (await import('./build.mjs')).default('preview', { _: ['demo'] });
		if (!existsSync(join(dir, 'render', 'demo_apercu.mp4'))) throw new Error('le rendu d’essai n’a rien produit.');
		console.log(`\nLa chaîne complète fonctionne : page → images → son → vidéo (${join(dir, 'render', 'demo_apercu.mp4')}).`);
	} finally {
		process.chdir(cwd);
	}
}
