// Open a video page in headless Chromium and drive it frame by frame.
import { runtime, fail } from './util.mjs';
import { serve } from './server.mjs';

// Grey-scale antialiasing and no hinting: glyphs keep their shape while they scale and move.
const ARGS = ['--disable-lcd-text', '--font-render-hinting=none'];

export async function launch() {
	const { chromium } = runtime('playwright');
	return chromium.launch({ args: ARGS });
}

// Returns a handle on one loaded video page. `scale` is the output scale (0.5 = half-size preview).
export async function openVideo(root, name, { scale = 1, browser, server, query = '' } = {}) {
	const ownServer = !server;
	const ownBrowser = !browser;
	server ??= await serve(root);
	browser ??= await launch();
	// Above 1 the page is drawn with more pixels; below 1 the frame is drawn full size and captured smaller.
	const context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: Math.max(1, scale) });
	const page = await context.newPage();
	const problems = [];
	page.on('pageerror', (e) => problems.push(`erreur de script : ${e.message}`));
	page.on('console', (m) => m.type() === 'error' && problems.push(`console : ${m.text()}`));
	page.on('requestfailed', (r) => problems.push(`fichier introuvable : ${r.url().replace(server.origin, '')}`));
	page.on('response', (r) => r.status() >= 400 && problems.push(`fichier introuvable (${r.status()}) : ${r.url().replace(server.origin, '')}`));
	await page.goto(`${server.origin}/videos/${name}.html${query}`, { waitUntil: 'load' });
	try {
		await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
	} catch {
		await browser.close();
		fail(`videos/${name}.html ne s'est pas déclarée prête (appelle done() à la fin du script).\n${problems.join('\n')}`);
	}
	const meta = await page.evaluate(() => window.META);
	await page.setViewportSize({ width: meta.w, height: meta.h });
	const cdp = await context.newCDPSession(page);
	const down = Math.min(1, scale);
	const clip = { x: 0, y: 0, width: meta.w, height: meta.h, scale: down };
	return {
		page, cdp, meta, problems, browser, server,
		render: (t) => page.evaluate((t) => window.render(t), t),
		// PNG bytes of the frame at time t (or of a region of it).
		async shot(t, region) {
			if (t !== undefined) await page.evaluate((t) => window.render(t), t);
			const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, clip: region ? { ...region, scale: down } : clip });
			return Buffer.from(data, 'base64');
		},
		async close() {
			await context.close();
			if (ownBrowser) await browser.close();
			if (ownServer) server.close();
		}
	};
}
