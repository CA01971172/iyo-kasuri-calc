import * as JimpImport from "jimp";
const { intToRGBA, rgbaToInt } = JimpImport;

// 輝度を計算
function luminance(r: number, g: number, b: number) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

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
            let maxY = 0;

            for (const [dx, dy] of offsets) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

                const c = src.getPixelColor(nx, ny);
                const { r, g, b } = intToRGBA(c);

                const Y = luminance(r, g, b);
                if (Y > maxY) maxY = Y;
            }

            out.setPixelColor(rgbaToInt(maxY, maxY, maxY, 255), x, y);
        }
    }
    return out;
}
