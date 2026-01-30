import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Button, Typography, Paper, Divider, TextField, List, ListItem, ListItemText, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useKasuriContext } from '../contexts/KasuriProvider';
import { getHomographyMatrix, transformPoint } from '../utils/homography';

export default function MeasurementStep() {
const { image, points, config, setConfig, setStep, isPortrait } = useKasuriContext();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cacheCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const listEndRef = useRef<HTMLDivElement>(null); // ★スクロール先の目印用
    
    const [markers, setMarkers] = useState<{ yuki: number, hane: number, x: number, y: number }[]>([]);
    const [draggingPos, setDraggingPos] = useState<{ x: number, y: number } | null>(null);

    const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });

    // --- 1. 座標計算の基準となる「赤枠の比率」を算出 ---
    const rectRatio = useMemo(() => {
        // Step 2 で決めた4点の相対座標から、歪み補正後の論理的な比率を出す
        const topW = Math.sqrt(Math.pow(points[1].x - points[0].x, 2) + Math.pow(points[1].y - points[0].y, 2));
        const bottomW = Math.sqrt(Math.pow(points[2].x - points[3].x, 2) + Math.pow(points[2].y - points[3].y, 2));
        const leftH = Math.sqrt(Math.pow(points[3].x - points[0].x, 2) + Math.pow(points[3].y - points[0].y, 2));
        const rightH = Math.sqrt(Math.pow(points[2].x - points[1].x, 2) + Math.pow(points[2].y - points[1].y, 2));
        return ((topW + bottomW) / 2) / ((leftH + rightH) / 2);
    }, [points]);

    const invHMatrix = useMemo(() => {
        const dst = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
        return getHomographyMatrix(dst, points); //
    }, [points]);

    // --- 2. キャッシュ生成（常に rectRatio に基づく） ---
    const generateCache = useCallback(() => {
        if (!image || !invHMatrix) return;
        
        const img = new Image();
        img.onload = () => {
            const canvasW = 800;
            const canvasH = Math.round(800 / rectRatio); // config 依存をやめて rectRatio を基準にする
            
            const cCanvas = document.createElement('canvas');
            cCanvas.width = canvasW;
            cCanvas.height = canvasH;
            const cCtx = cCanvas.getContext('2d');
            if (!cCtx) return;

            const tCanvas = document.createElement('canvas');
            tCanvas.width = img.width;
            tCanvas.height = img.height;
            const tCtx = tCanvas.getContext('2d');
            if (!tCtx) return;
            tCtx.drawImage(img, 0, 0);
            const inData = tCtx.getImageData(0, 0, img.width, img.height).data;
            const outData = cCtx.createImageData(canvasW, canvasH);

            for (let y = 0; y < canvasH; y++) {
                for (let x = 0; x < canvasW; x++) {
                    const srcPos = transformPoint(x / canvasW, y / canvasH, invHMatrix); //
                    const sx = Math.floor(srcPos.x * img.width);
                    const sy = Math.floor(srcPos.y * img.height);
                    if (sx >= 0 && sx < img.width && sy >= 0 && sy < img.height) {
                        const outIdx = (y * canvasW + x) * 4;
                        const inIdx = (sy * img.width + sx) * 4;
                        outData.data[outIdx] = inData[inIdx];
                        outData.data[outIdx+1] = inData[inIdx+1];
                        outData.data[outIdx+2] = inData[inIdx+2];
                        outData.data[outIdx+3] = 255;
                    }
                }
            }
            cCtx.putImageData(outData, 0, 0);
            cacheCanvasRef.current = cCanvas;
            draw();
        };
        img.src = image;
    }, [image, invHMatrix, rectRatio]); // config を除外して安定させる

    useEffect(() => { generateCache(); }, [generateCache]);

    // --- 2. 爆速化した描画関数 ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const cache = cacheCanvasRef.current;
        if (!canvas || !cache) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // キャンバスをクリア
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        
        // ズームとパンの適用
        // 中心点からズームするように調整
        ctx.translate(zoom.x, zoom.y);
        ctx.scale(zoom.scale, zoom.scale);

        // キャッシュ画像の描画（比率維持はこれまでのロジック通り）
        ctx.drawImage(cache, 0, 0);

        // マーカーの描画（ズームに合わせて小さく見えるようにサイズ調整）
        markers.forEach(m => {
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(m.x * cache.width, m.y * cache.height, 2 / zoom.scale, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();
    }, [markers, draggingPos, zoom]);

    useEffect(() => { draw(); }, [draw]);

    // --- 3. 座標取得（キャッシュの比率と完全に一致させる） ---
    const getPos = (e: any) => {
        const canvas = canvasRef.current;
        const cache = cacheCanvasRef.current;
        if (!canvas || !cache) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // 1. ブラウザ上のタッチ位置を、Canvasの表示サイズに対する 0~1 の比率に変換
        const touchRelX = (clientX - rect.left) / rect.width;
        const touchRelY = (clientY - rect.top) / rect.height;

        // 2. ズーム倍率と移動量を逆算して、拡大前の「論理的なCanvas内座標」に戻す
        // ※ zoom = { scale: number, x: number, y: number } という state を想定
        // zoom.x, zoom.y はピクセル単位の移動量なので、Canvasの解像度で補正します
        const unzoomedX = (touchRelX * canvas.width - zoom.x) / zoom.scale;
        const unzoomedY = (touchRelY * canvas.height - zoom.y) / zoom.scale;

        // 3. アスペクト比の計算（ここは既存ロジックを維持）
        const containerRatio = rect.width / rect.height; // 表示枠の比率
        const contentRatio = cache.width / cache.height; // 補正画像の比率

        let x, y;

        // 4. 「拡大前の座標」に対して、黒い余白（Letterbox）を差し引く
        if (containerRatio > contentRatio) {
            // 左右に余白がある場合
            const displayWidth = canvas.height * contentRatio; 
            const offsetX = (canvas.width - displayWidth) / 2;
            x = (unzoomedX - offsetX) / displayWidth;
            y = unzoomedY / canvas.height;
        } else {
            // 上下に余白がある場合（今回の portrait で多いケース）
            const displayHeight = canvas.width / contentRatio;
            const offsetY = (canvas.height - displayHeight) / 2;
            x = unzoomedX / canvas.width;
            y = (unzoomedY - offsetY) / displayHeight;
        }

        return {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y))
        };
    };

    const handleStart = (e: any) => setDraggingPos(getPos(e));
    const handleMove = (e: any) => draggingPos && setDraggingPos(getPos(e));

    // handleEnd (指を離した時) に初めて「元の歪んだ画像」のどこだったのかを逆算して往・羽を出す
    const handleEnd = () => {
        if (draggingPos && invHMatrix) {
            // 表示されている補正後座標 (0~1) から、実際の「往・羽」を計算
            const u = Math.max(0, Math.min(1, draggingPos.x));
            const v = Math.max(0, Math.min(1, draggingPos.y));

            setMarkers([...markers, { 
                yuki: Math.round(v * config.totalYuki), 
                hane: Math.round(u * config.totalHane), 
                x: u, 
                y: v 
            }]);
            setDraggingPos(null);
        }
    };

    // --- マーカーが追加されたらスクロールを実行 ---
    useEffect(() => {
        if (markers.length > 0) {
            listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [markers]); // markers が更新されるたびに発動

    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: isPortrait ? 'column' : 'row', 
            height: '100%', 
            p: 2, 
            gap: 2, 
            boxSizing: 'border-box' 
        }}>
            {/* 左/上：Canvasエリア */}
            <Box sx={{ 
                flexGrow: 2, // 縦向きの時、Canvasにより多くのスペースを割り当てる
                display: 'flex', 
                flexDirection: 'column', 
                minHeight: isPortrait ? '50vh' : 0 // 縦向きの時、画面の半分はCanvasを確保
            }}>
                <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, fontWeight: 'bold' }}>
                    補正済み図面で計測
                </Typography>
                <Box sx={{ 
                    flexGrow: 1, 
                    bgcolor: '#222', 
                    borderRadius: '12px', 
                    overflow: 'hidden', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center' 
                }}>
                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd}
                        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
                        style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'contain', 
                            touchAction: 'none', 
                            cursor: 'crosshair' 
                        }}
                    />
                </Box>
            </Box>

            {/* 右/下：操作・リストエリア */}
            <Box sx={{ 
                width: isPortrait ? '100%' : '320px', 
                height: isPortrait ? '40%' : '100%', // 縦向き時は高さを制限
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2, 
                flexShrink: 0 
            }}>
                <Paper sx={{ p: 2, borderRadius: '12px' }}>
                    {/* 設定部分はそのまま */}
                    <Typography variant="subtitle2" gutterBottom color="textSecondary">図面の設定 (total)</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField label="総往数" type="number" value={config.totalYuki} onChange={(e) => setConfig({ ...config, totalYuki: Number(e.target.value) })} fullWidth size="small" />
                        <TextField label="総羽数" type="number" value={config.totalHane} onChange={(e) => setConfig({ ...config, totalHane: Number(e.target.value) })} fullWidth size="small" />
                    </Box>
                </Paper>

                <Paper sx={{ 
                    flexGrow: 1, 
                    overflow: 'hidden', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    borderRadius: '12px',
                    minHeight: 0 // これを入れないと flexContainer 内で縮まない
                }}>
                    <Typography variant="subtitle1" sx={{ p: 2, pb: 1, fontWeight: 'bold', bgcolor: '#f5f5f5' }}>
                        計測リスト
                    </Typography>
                    <Divider />
                    {/* リスト部分にスクロールを強制する */}
                    <List dense sx={{ 
                        flexGrow: 1, 
                        overflowY: 'auto', // 縦方向にスクロールを許可
                        maxHeight: isPortrait ? '200px' : 'none' // 縦向きの時だけリストの高さを抑える
                    }}>
                        {markers.map((m, i) => (
                            <ListItem key={i} divider secondaryAction={
                                <IconButton edge="end" onClick={() => setMarkers(markers.filter((_, idx) => idx !== i))}>
                                    <DeleteIcon />
                                </IconButton>
                            }>
                                <ListItemText primary={`${i + 1}. ${m.yuki} 往 / ${m.hane} 羽`} />
                            </ListItem>
                        ))}
                        <div ref={listEndRef} /> {/* ★スクロール先の目印用 */}
                    </List>
                </Paper>

                <Button fullWidth variant="outlined" onClick={() => setStep(1)} sx={{ mt: 'auto' }}>
                    四隅を調整し直す
                </Button>
            </Box>
        </Box>
    );
}
