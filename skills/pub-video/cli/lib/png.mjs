// Minimal PNG decoder (8-bit RGB or RGBA, non-interlaced: what Chromium screenshots are).
import { inflateSync } from 'node:zlib';

export function decodePng(buf) {
	let p = 8;
	let w = 0;
	let h = 0;
	let type = 6;
	const idat = [];
	while (p < buf.length) {
		const len = buf.readUInt32BE(p);
		const name = buf.toString('latin1', p + 4, p + 8);
		const data = buf.subarray(p + 8, p + 8 + len);
		if (name === 'IHDR') {
			w = data.readUInt32BE(0);
			h = data.readUInt32BE(4);
			type = data[9];
			if (data[8] !== 8 || (type !== 2 && type !== 6) || data[12] !== 0) throw new Error('format PNG non géré');
		} else if (name === 'IDAT') idat.push(data);
		else if (name === 'IEND') break;
		p += 12 + len;
	}
	const ch = type === 6 ? 4 : 3;
	const raw = inflateSync(Buffer.concat(idat));
	const stride = w * ch;
	const out = Buffer.alloc(h * stride);
	for (let y = 0; y < h; y++) {
		const f = raw[y * (stride + 1)];
		const row = y * (stride + 1) + 1;
		const o = y * stride;
		for (let x = 0; x < stride; x++) {
			const a = x >= ch ? out[o + x - ch] : 0;
			const b = y ? out[o + x - stride] : 0;
			const c = x >= ch && y ? out[o + x - stride - ch] : 0;
			let v = raw[row + x];
			if (f === 1) v += a;
			else if (f === 2) v += b;
			else if (f === 3) v += (a + b) >> 1;
			else if (f === 4) {
				const pa = Math.abs(b - c);
				const pb = Math.abs(a - c);
				const pc = Math.abs(a + b - 2 * c);
				v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
			}
			out[o + x] = v & 255;
		}
	}
	return { w, h, ch, data: out };
}
