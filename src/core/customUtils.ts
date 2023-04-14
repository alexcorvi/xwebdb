const lut: string[] = [];
for (let i = 0; i < 256; i++) {
	lut[i] = (i < 16 ? "0" : "") + i.toString(16);
}
export function uid(): string {
	let d0 = (Math.random() * 0xffffffff) | 0;
	let d1 = (Math.random() * 0xffffffff) | 0;
	let d2 = (Math.random() * 0xffffffff) | 0;
	let d3 = (Math.random() * 0xffffffff) | 0;
	return (
		lut[d0 & 0xff] +
		lut[(d0 >> 8) & 0xff] +
		lut[(d0 >> 16) & 0xff] +
		lut[(d0 >> 24) & 0xff] +
		"-" +
		lut[d1 & 0xff] +
		lut[(d1 >> 8) & 0xff] +
		"-" +
		lut[((d1 >> 16) & 0x0f) | 0x40] +
		lut[(d1 >> 24) & 0xff] +
		"-" +
		lut[(d2 & 0x3f) | 0x80] +
		lut[(d2 >> 8) & 0xff] +
		"-" +
		lut[(d2 >> 16) & 0xff] +
		lut[(d2 >> 24) & 0xff] +
		lut[d3 & 0xff] +
		lut[(d3 >> 8) & 0xff] +
		lut[(d3 >> 16) & 0xff] +
		lut[(d3 >> 24) & 0xff]
	);
}

export function randomString(len: number = 8) {
	return Array.from(new Uint8Array(120))
		.map((x) => Math.random().toString(36))
		.join("")
		.split("0.")
		.join("")
		.substring(0, len);
}


/**
 * XXHash32
*/
export function xxh(str: string, seed = 0) {
	const encoder = new TextEncoder();
	const input = encoder.encode(str);
	const prime = 0x9e3779b1;
	let hash = seed + 0xdeadbeef;
	let len = input.length;

	for (let i = 0; i + 4 <= len; i += 4) {
		let word =
			(input[i] |
				(input[i + 1] << 8) |
				(input[i + 2] << 16) |
				(input[i + 3] << 24)) >>>
			0;
		hash += word * prime;
		hash = Math.imul(hash, prime);
	}

	if (len & 3) {
		let lastBytes = input.slice(len - (len & 3));
		let word = 0;
		for (let i = 0; i < lastBytes.length; i++) {
			word += lastBytes[i] << (i * 8);
		}
		hash += word * prime;
		hash = Math.imul(hash, prime);
	}

	hash ^= hash >>> 15;
	hash = Math.imul(hash, prime);
	hash ^= hash >>> 13;
	hash = Math.imul(hash, prime);
	hash ^= hash >>> 16;

	return hash >>> 0;
}