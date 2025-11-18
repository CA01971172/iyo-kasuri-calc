import * as JimpImport from "jimp";
const { intToRGBA, rgbaToInt } = JimpImport;

export function autoWhiteNormalize(src: any): any {
    const w = src.width;
    const h = src.height;
    const pixels: { r: number, g: number, b: number, brightness: number }[] = [];

    // 1. 全ピクセルの明るさを収集
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const c = src.getPixelColor(x, y);
            const { r, g, b } = intToRGBA(c);
            const brightness = (r + g + b) / 3;
            pixels.push({ r, g, b, brightness });
        }
    }

    // 2. 明るいピクセル上位10%を「白候補」として抽出
    pixels.sort((a, b) => b.brightness - a.brightness);
    const topFraction = 0.1;
    const topPixels = pixels.slice(0, Math.floor(pixels.length * topFraction));

    // 3. 白の平均と標準偏差を計算
    const avg = topPixels.reduce(
        (acc, p) => {
            acc.r += p.r; acc.g += p.g; acc.b += p.b;
            return acc;
        }, { r: 0, g: 0, b: 0 }
    );

    avg.r /= topPixels.length;
    avg.g /= topPixels.length;
    avg.b /= topPixels.length;

    // 標準偏差
    const std = topPixels.reduce(
        (acc, p) => {
            acc.r += (p.r - avg.r) ** 2;
            acc.g += (p.g - avg.g) ** 2;
            acc.b += (p.b - avg.b) ** 2;
            return acc;
        }, { r: 0, g: 0, b: 0 }
    );

    std.r = Math.sqrt(std.r / topPixels.length);
    std.g = Math.sqrt(std.g / topPixels.length);
    std.b = Math.sqrt(std.b / topPixels.length);

    // 4. 白化：平均±固定値
    const threshold = 50; // 平均から±50の範囲を白とみなす
    const out = src.clone();

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const c = src.getPixelColor(x, y);
            const { r, g, b, a } = intToRGBA(c);

            // 白の範囲チェック
            const inWhiteRange =
                r >= avg.r - threshold && r <= avg.r + threshold &&
                g >= avg.g - threshold && g <= avg.g + threshold &&
                b >= avg.b - threshold && b <= avg.b + threshold;

            if (inWhiteRange) {
                out.setPixelColor(rgbaToInt(255, 255, 255, a), x, y);
            }
        }
    }

    return out;
}
