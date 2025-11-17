import * as JimpImport from "jimp";
const { Jimp, intToRGBA, rgbaToInt } = JimpImport;

// 3x3 の隣接オフセット
const offsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0], [0,  0], [1,  0],
    [-1,  1], [0,  1], [1,  1],
];

// 膨張処理（dilate）
export function dilate(src: any): any {
    const w = src.width;
    const h = src.height;
    const out = src.clone();

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let maxR = 0, maxG = 0, maxB = 0;

            for (const [dx, dy] of offsets) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

                const c = src.getPixelColor(nx, ny);
                const { r, g, b } = intToRGBA(c);

                if (r > maxR) maxR = r;
                if (g > maxG) maxG = g;
                if (b > maxB) maxB = b;
            }

            out.setPixelColor(rgbaToInt(maxR, maxG, maxB, 255), x, y);
        }
    }
    return out;
}
