/**
 * 絣図面の座標変換用ユーティリティ
 */

export type Point = { x: number; y: number };

/**
 * 4点の対応関係からホモグラフィ行列（3x3）を算出する
 * src: 歪んだ4点 (Calibrationで指定した点)
 * dst: 変換後の4点 (通常は [0,0], [1,0], [1,1], [0,1])
 */
export function getHomographyMatrix(src: Point[], dst: Point[]): number[] | null {
    const matrix: number[][] = [];
    for (let i = 0; i < 4; i++) {
        matrix.push([src[i].x, src[i].y, 1, 0, 0, 0, -src[i].x * dst[i].x, -src[i].y * dst[i].x, dst[i].x]);
        matrix.push([0, 0, 0, src[i].x, src[i].y, 1, -src[i].x * dst[i].y, -src[i].y * dst[i].y, dst[i].y]);
    }

    // ガウスの消去法で連立方程式を解く（簡易実装）
    const res = solveLinearEquation(matrix);
    if (!res) return null;
    return [...res, 1]; // 最後の要素 h33 = 1 ととして返す
}

/**
 * 行列を使って座標(x, y)を変換する
 */
export function transformPoint(x: number, y: number, h: number[]): Point {
    const tmp = h[0] * x + h[1] * y + h[2];
    const tmp2 = h[3] * x + h[4] * y + h[5];
    const tmp3 = h[6] * x + h[7] * y + h[8];
    return { x: tmp / tmp3, y: tmp2 / tmp3 };
}

/**
 * 連立方程式を解く補助関数
 */
function solveLinearEquation(matrix: number[][]): number[] | null {
    const n = 8;
    for (let i = 0; i < n; i++) {
        let max = i;
        for (let j = i + 1; j < n; j++) {
            if (Math.abs(matrix[j][i]) > Math.abs(matrix[max][i])) max = j;
        }
        [matrix[i], matrix[max]] = [matrix[max], matrix[i]];
        if (Math.abs(matrix[i][i]) < 1e-10) return null;

        for (let j = i + 1; j < n; j++) {
            const t = matrix[j][i] / matrix[i][i];
            for (let k = i; k <= n; k++) matrix[j][k] -= t * matrix[i][k];
        }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let s = 0;
        for (let j = i + 1; j < n; j++) s += matrix[i][j] * x[j];
        x[i] = (matrix[i][n] - s) / matrix[i][i];
    }
    return x;
}
