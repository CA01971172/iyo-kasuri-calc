import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Button, Typography, Paper, Divider, TextField, List, ListItem, ListItemText, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useKasuriContext } from '../contexts/KasuriProvider';
import { getHomographyMatrix, transformPoint } from '../utils/homography';

export default function MeasurementStep() {
    const { image, points, config, setConfig, setStep, isPortrait } = useKasuriContext();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cacheCanvasRef = useRef<HTMLCanvasElement | null>(null); // キャッシュ用
    
    const [markers, setMarkers] = useState<{ yuki: number, hane: number, x: number, y: number }[]>([]);
    const [draggingPos, setDraggingPos] = useState<{ x: number, y: number } | null>(null);

    // --- 1. 射影変換行列の計算 ---
    // 逆行列（描画用）：単位正方形から元の画像の座標へ
    const invHMatrix = useMemo(() => {
        const dst = [
            { x: 0, y: 0 }, { x: 1, y: 0 }, 
            { x: 1, y: 1 }, { x: 0, y: 1 }
        ];
        return getHomographyMatrix(dst, points);
    }, [points]);

    // --- 1. 画像補正キャッシュの生成 ---
    const generateCache = useCallback(() => {
        if (!image || !invHMatrix) return;
        
        const img = new Image();
        img.onload = () => {
            const canvasW = 800;
            const canvasH = Math.round(800 * (config.totalYuki / config.totalHane || 1));
            
            const cCanvas = document.createElement('canvas');
            cCanvas.width = canvasW;
            cCanvas.height = canvasH;
            const cCtx = cCanvas.getContext('2d');
            if (!cCtx) return;

            // 元画像のデータ取得
            const tCanvas = document.createElement('canvas');
            tCanvas.width = img.width;
            tCanvas.height = img.height;
            const tCtx = tCanvas.getContext('2d');
            if (!tCtx) return;
            tCtx.drawImage(img, 0, 0);
            const inData = tCtx.getImageData(0, 0, img.width, img.height).data;
            const outData = cCtx.createImageData(canvasW, canvasH);

            // 射影変換ループ（ここを1回だけ実行するようにする）
            for (let y = 0; y < canvasH; y++) {
                for (let x = 0; x < canvasW; x++) {
                    const srcPos = transformPoint(x / canvasW, y / canvasH, invHMatrix);
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
            cacheCanvasRef.current = cCanvas; // キャッシュに保存
            draw(); // 初回描画
        };
        img.src = image;
    }, [image, invHMatrix, config.totalYuki, config.totalHane]);

    // 設定や画像が変わったときだけキャッシュを更新
    useEffect(() => {
        generateCache();
    }, [generateCache]);

    // --- 2. 爆速化した描画関数 ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const cache = cacheCanvasRef.current;
        if (!canvas || !cache) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = cache.width;
        canvas.height = cache.height;

        // キャッシュされた補正済み画像を貼り付けるだけ（爆速！）
        ctx.drawImage(cache, 0, 0);

        // マーカーとガイドの描画
        ctx.save();
        markers.forEach(m => {
            ctx.fillStyle = '#ffff00';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.arc(m.x * canvas.width, m.y * canvas.height, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });

        if (draggingPos) {
            const px = draggingPos.x * canvas.width;
            const py = draggingPos.y * canvas.height;
            ctx.strokeStyle = '#00e5ff';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height);
            ctx.moveTo(0, py); ctx.lineTo(canvas.width, py);
            ctx.stroke();
        }
        ctx.restore();
    }, [markers, draggingPos]);

    useEffect(() => { draw(); }, [draw]);

    // Canvas上の物理的な座標を 0~1 に変換
    const getPos = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // Canvasの表示領域内での相対位置 (0.0 ~ 1.0)
        return {
            x: (clientX - rect.left) / rect.width,
            y: (clientY - rect.top) / rect.height
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

    return (
        <Box sx={{ display: 'flex', flexDirection: isPortrait ? 'column' : 'row', height: '100%', p: 2, gap: 2, boxSizing: 'border-box' }}>
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, fontWeight: 'bold' }}>
                    補正済み図面で計測
                </Typography>
                <Box sx={{ flexGrow: 1, bgcolor: '#222', borderRadius: '12px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd}
                        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', touchAction: 'none', cursor: 'crosshair' }}
                    />
                </Box>
            </Box>

            <Box sx={{ width: isPortrait ? '100%' : '320px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                {/* 右パネルの設定・リスト部分は前回のコードを継承 */}
                <Paper sx={{ p: 2, borderRadius: '12px' }}>
                    <Typography variant="subtitle2" gutterBottom color="textSecondary">図面の設定 (total)</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField label="総往数" type="number" value={config.totalYuki} onChange={(e) => setConfig({ ...config, totalYuki: Number(e.target.value) })} fullWidth size="small" />
                        <TextField label="総羽数" type="number" value={config.totalHane} onChange={(e) => setConfig({ ...config, totalHane: Number(e.target.value) })} fullWidth size="small" />
                    </Box>
                </Paper>

                <Paper sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: '12px' }}>
                    <Typography variant="subtitle1" sx={{ p: 2, pb: 1, fontWeight: 'bold', bgcolor: '#f5f5f5' }}>計測リスト</Typography>
                    <Divider />
                    <List dense sx={{ flexGrow: 1, overflow: 'auto' }}>
                        {markers.map((m, i) => (
                            <ListItem key={i} divider secondaryAction={
                                <IconButton edge="end" onClick={() => setMarkers(markers.filter((_, idx) => idx !== i))}>
                                    <DeleteIcon />
                                </IconButton>
                            }>
                                <ListItemText 
                                    primary={`${i + 1}. ${m.yuki} 往 / ${m.hane} 羽`} 
                                />
                            </ListItem>
                        ))}
                    </List>
                </Paper>

                <Button fullWidth variant="outlined" onClick={() => setStep(1)}>
                    四隅を調整し直す
                </Button>
            </Box>
        </Box>
    );
}
