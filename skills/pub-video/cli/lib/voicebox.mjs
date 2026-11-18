// voicebox: client of a local voicebox server (https://github.com/jamiepine/voicebox), the open-source voice
// studio that clones a voice from a short sample. Only what the voice-over needs: find the server, list its
// voice profiles, and turn one line of text into an audio file with a profile.
import { writeFile } from 'node:fs/promises';

// The desktop app listens on 17493; the project's docker-compose.yml publishes the same server on 17600.
const URLS = ['http://127.0.0.1:17493', 'http://127.0.0.1:17600'];
// OmniVoice weights are non-commercial, and these engines speak English only.
const NON_COMMERCIAL = new Set(['omnivoice']);
const ENGLISH_ONLY = new Set(['luxtts', 'chatterbox_turbo']);

// The first server that answers /health: the --url given, else VOICEBOX_URL, else the usual addresses.
export async function connect(url = process.env.VOICEBOX_URL) {
	const tried = url ? [String(url).replace(/\/+$/, '')] : URLS;
	for (const u of tried) {
		try {
			const r = await fetch(`${u}/health`, { signal: AbortSignal.timeout(3000) });
			if (r.ok) return { url: u, health: await r.json() };
		} catch {
			// not this one
		}
	}
	return { url: null, tried };
}

async function json(server, path, init) {
	const r = await fetch(`${server.url}${path}`, init);
	if (!r.ok) throw new Error(`voicebox ${init?.method ?? 'GET'} ${path} : ${r.status} ${(await r.text()).slice(0, 300)}`);
	return r.json();
}

export const profiles = (server) => json(server, '/profiles');

// A profile by id or by name (case and accents as typed by the user do not matter).
export function pick(list, wanted) {
	const k = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
	return list.find((p) => p.id === wanted) ?? list.find((p) => k(p.name) === k(wanted)) ?? null;
}

// Why an engine cannot voice this video, or null.
export function engineProblem(engine, language) {
	if (NON_COMMERCIAL.has(engine)) return `le moteur ${engine} est sous licence non commerciale : une vidéo à publier ne peut pas l'utiliser`;
	if (ENGLISH_ONLY.has(engine) && language !== 'en') return `le moteur ${engine} ne parle qu'anglais`;
	return null;
}

// Generate one line and write the audio to `out`. Generation is queued on the server: wait for its status
// stream (server-sent events) to say completed, then download the audio.
export async function speak(server, { text, profile, language, engine, seed }, out) {
	const body = { profile_id: profile, text, language };
	if (engine) body.engine = engine;
	if (seed !== undefined) body.seed = Number(seed);
	const gen = await json(server, '/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
	await finished(server, gen.id);
	const r = await fetch(`${server.url}/audio/${gen.id}`);
	if (!r.ok) throw new Error(`voicebox : l'audio de la génération ${gen.id} est introuvable (${r.status}).`);
	await writeFile(out, Buffer.from(await r.arrayBuffer()));
}

async function finished(server, id) {
	const r = await fetch(`${server.url}/generate/${id}/status`, { headers: { accept: 'text/event-stream' } });
	if (!r.ok || !r.body) throw new Error(`voicebox : impossible de suivre la génération ${id} (${r.status}).`);
	const decoder = new TextDecoder();
	let buf = '';
	for await (const chunk of r.body) {
		buf += decoder.decode(chunk, { stream: true });
		let end;
		while ((end = buf.indexOf('\n\n')) >= 0) {
			const event = buf.slice(0, end);
			buf = buf.slice(end + 2);
			const data = event.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
			if (!data) continue;
			const s = JSON.parse(data);
			if (s.status === 'completed') return;
			if (s.status === 'failed' || s.status === 'not_found') throw new Error(`voicebox : la génération a échoué (${s.status}${s.error ? ` : ${s.error}` : ''}).`);
		}
	}
	throw new Error(`voicebox : le suivi de la génération ${id} s'est arrêté avant la fin.`);
}
