// Minimal LZ4 frame decoder (https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md)
// for the dance motion. Handles linked and independent blocks, skips checksums
// without verifying them, and doesn't support dictionaries.

const MAGIC = 0x184d2204;

export function isLz4Frame(buffer: ArrayBuffer) {
	return (
		buffer.byteLength >= 4 &&
		new DataView(buffer).getUint32(0, true) === MAGIC
	);
}

export function decodeLz4Frame(buffer: ArrayBuffer): Uint8Array {
	const src = new Uint8Array(buffer);
	const view = new DataView(buffer);
	if (!isLz4Frame(buffer)) throw new Error("Not an LZ4 frame");

	const flg = src[4];
	if (flg >> 6 !== 1) throw new Error("Unsupported LZ4 frame version");
	if (flg & 0x01) throw new Error("LZ4 dictionaries aren't supported");
	const blockChecksum = (flg & 0x10) !== 0;
	const hasContentSize = (flg & 0x08) !== 0;
	const contentChecksum = (flg & 0x04) !== 0;

	// magic, FLG, BD, [content size], header checksum
	let pos = 7 + (hasContentSize ? 8 : 0);
	let out = new Uint8Array(
		hasContentSize
			? Number(view.getBigUint64(6, true))
			: Math.max(src.length * 4, 1 << 16),
	);
	let len = 0;

	const ensure = (extra: number) => {
		if (len + extra <= out.length) return;
		const grown = new Uint8Array(Math.max(out.length * 2, len + extra));
		grown.set(out.subarray(0, len));
		out = grown;
	};

	for (;;) {
		const size = view.getUint32(pos, true);
		pos += 4;
		if (size === 0) break; // end mark

		const blockLen = size & 0x7fffffff;
		const end = pos + blockLen;
		if (size & 0x80000000) {
			// stored uncompressed
			ensure(blockLen);
			out.set(src.subarray(pos, end), len);
			len += blockLen;
		} else {
			while (pos < end) {
				const token = src[pos++];

				let literals = token >> 4;
				if (literals === 15) {
					let b;
					do literals += b = src[pos++];
					while (b === 255);
				}
				ensure(literals);
				out.set(src.subarray(pos, pos + literals), len);
				len += literals;
				pos += literals;
				if (pos >= end) break; // the last sequence is literals only

				const offset = src[pos] | (src[pos + 1] << 8);
				pos += 2;
				let match = (token & 15) + 4;
				if ((token & 15) === 15) {
					let b;
					do match += b = src[pos++];
					while (b === 255);
				}
				ensure(match);
				// byte by byte: matches may overlap their own output
				for (let from = len - offset, i = 0; i < match; i++)
					out[len++] = out[from + i];
			}
		}
		pos = end + (blockChecksum ? 4 : 0);
	}
	if (contentChecksum) pos += 4;

	return out.subarray(0, len);
}
