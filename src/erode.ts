import * as JimpImport from "jimp";
const { Jimp, intToRGBA, rgbaToInt } = JimpImport;

// 3x3 の隣接オフセット
const offsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0], [0,  0], [1,  0],
    [-1,  1], [0,  1], [1,  1],
];

// 収縮処理（erode）
export function erode(src: any): any {
    const w = src.width;
    const h = src.height;
    const out = src.clone();

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let minR = 255, minG = 255, minB = 255;

            for (const [dx, dy] of offsets) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

                const c = src.getPixelColor(nx, ny);
                const { r, g, b } = intToRGBA(c);

                if (r < minR) minR = r;
                if (g < minG) minG = g;
                if (b < minB) minB = b;
            }

            out.setPixelColor(rgbaToInt(minR, minG, minB, 255), x, y);
        }
    }
    return out;
}
