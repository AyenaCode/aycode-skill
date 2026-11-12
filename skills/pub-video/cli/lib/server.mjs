// Static server for a project: ES modules do not load from file:// URLs.
// /engine/* comes from the skill, /vendor/gsap/* from the shared runtime, everything else from the project.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { SKILL, DATA } from './util.mjs';

const TYPES = {
	'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
	'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml',
	'.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};

export async function serve(root) {
	const mounts = [
		['/engine/', join(SKILL, 'engine') + sep],
		['/vendor/gsap/', join(DATA, 'node_modules', 'gsap') + sep],
		['/', normalize(root) + sep]
	];
	const server = createServer(async (req, res) => {
		try {
			const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
			const [prefix, dir] = mounts.find(([p]) => path.startsWith(p));
			const file = normalize(join(dir, path.slice(prefix.length)));
			if (!file.startsWith(dir)) throw new Error('outside');
			const body = await readFile(file);
			res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
			res.end(body);
		} catch {
			res.writeHead(404);
			res.end();
		}
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
