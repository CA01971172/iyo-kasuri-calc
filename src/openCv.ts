import cv from "opencv.js";
import { createCanvas, loadImage } from "canvas";

function erode(src: cv.Mat, size = 3) {
    const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(size, size));
    const dst = new cv.Mat();
    cv.erode(src, dst, k);
    return dst;
}

function dilate(src: cv.Mat, size = 3) {
    const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(size, size));
    const dst = new cv.Mat();
    cv.dilate(src, dst, k);
    return dst;
}

export async function deskew(inputPath: string, outputPath: string) {
    const src = cv.imread(await loadImage(inputPath));

    // グレースケール
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Canny
    let edges = new cv.Mat();
    cv.Canny(gray, edges, 50, 200);

    // HoughLines で直線検出
    let lines = new cv.Mat();
    cv.HoughLines(edges, lines, 1, Math.PI / 180, 120);

    // 角度推定（θの平均）
    let angles: number[] = [];
    for (let i = 0; i < lines.rows; i++) {
        const rho = lines.data32F[i * 2];
        const theta = lines.data32F[i * 2 + 1];

        // 水平線付近だけ使う（ノイズ除去）
        if (theta > Math.PI / 4 && theta < (3 * Math.PI) / 4) {
            angles.push(theta);
        }
    }

    const averageTheta =
        angles.reduce((a, b) => a + b, 0) / (angles.length || 1);

    // θ → 回転角度（度）
    const angle = (averageTheta - Math.PI / 2) * (180 / Math.PI);

    // 回転処理
    let M = cv.getRotationMatrix2D(
        new cv.Point(src.cols / 2, src.rows / 2),
        angle,
        1
    );
    let rotated = new cv.Mat();
    cv.warpAffine(
        src,
        rotated,
        M,
        new cv.Size(src.cols, src.rows),
        cv.INTER_LINEAR,
        cv.BORDER_CONSTANT,
        new cv.Scalar(255, 255, 255, 255) // 背景白
    );

    // 保存
    const canvas = createCanvas(rotated.cols, rotated.rows);
    cv.imshow(canvas, rotated);

    require("fs").writeFileSync(
        outputPath,
        canvas.toBuffer("image/png")
    );

    // メモリ解放
    src.delete();
    gray.delete();
    edges.delete();
    lines.delete();
    M.delete();
    rotated.delete();
}
