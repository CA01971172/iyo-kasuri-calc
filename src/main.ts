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

    // 白背景黒絵柄の画像に対して画像処理を逆に実行
    const dilated = dilate(image); // 白を膨張(dilation)させてノイズ(下書き等)を除去
    const closed = erode(dilated);　// closing(dilate->erode)で絵柄を元に戻す

    closed.write("./images/output.png", (err: any) => {
        if (err) console.error(err);
        else console.log("収縮後の画像を出力しました。");
    });
}

main();
