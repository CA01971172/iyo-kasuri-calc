import { Jimp, intToRGBA } from "jimp";

async function main() {
    const filePath = "src/image.png";
    const image = await Jimp.read(filePath);

    console.log(`✅ 画像サイズ: ${image.width}x${image.height}`);

    // ピクセル色取得
    const color = image.getPixelColor(0, 0);
    const { r, g, b, a } = intToRGBA(color);
    console.log("左上ピクセル:", { r, g, b, a });

    // グレースケール変換
    const gray = image.clone().greyscale();
    gray.write("./output-gray.jpg", (err: any) => {
        if (err) console.error(err);
        else console.log("🖼️ グレースケール画像を出力しました。");
    });
}

main();
