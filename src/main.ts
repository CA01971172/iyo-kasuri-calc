import * as JimpImport from "jimp";
const { Jimp, intToRGBA } = JimpImport;
import { erode } from "./erode.ts";
import { dilate } from "./dilate.ts";

async function main() {
    const filePath = "src/image.png";
    const image = await Jimp.read(filePath);

    console.log(`✅ 画像サイズ: ${image.width}x${image.height}`);

    // ピクセル色取得
    const color = image.getPixelColor(0, 0);
    const { r, g, b, a } = intToRGBA(color);
    console.log("左上ピクセル:", { r, g, b, a });

    const dilated = dilate(image);
    const eroded = erode(dilated);

    eroded.write("./output.png", (err: any) => {
        if (err) console.error(err);
        else console.log("収縮後の画像を出力しました。");
    });
}

main();
