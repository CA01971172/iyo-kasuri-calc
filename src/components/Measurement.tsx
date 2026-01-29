import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Button, Typography, Paper, Divider, TextField, List, ListItem, ListItemText, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useKasuriContext } from '../contexts/KasuriProvider';
import { getHomographyMatrix, transformPoint } from '../utils/homography';

export default function MeasurementStep() {
    const { image, points, config, setConfig, setStep, isPortrait } = useKasuriContext();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const [markers, setMarkers] = useState<{ yuki: number, hane: number, x: number, y: number }[]>([]);
    const [draggingPos, setDraggingPos] = useState<{ x: number, y: number } | null>(null);

    // --- 1. 射影変換行列の計算 ---
    // points(歪んだ4点) から 単位正方形([0,0]~[1,1]) への変換行列
    const hMatrix = useMemo(() => {
        const dst = [
            { x: 0, y: 0 }, { x: 1, y: 0 }, 
            { x: 1, y: 1 }, { x: 0, y: 1 }
        ];
        return getHomographyMatrix(points, dst);
    }, [points]);

    // 逆行列（描画用）：単位正方形から元の画像の座標へ
    const invHMatrix = useMemo(() => {
        const dst = [
            { x: 0, y: 0 }, { x: 1, y: 0 }, 
            { x: 1, y: 1 }, { x: 0, y: 1 }
        ];
        return getHomographyMatrix(dst, points);
    }, [points]);

    // --- 2. 座標計算ロジック（ホモグラフィ版） ---
    const calculateYukiHane = useCallback((x: number, y: number) => {
        if (!hMatrix) return null;

        // タップした座標(x,y)を、補正後の座標(u,v)に変換
        const res = transformPoint(x, y, hMatrix);
        
        // 0.0〜1.0 の範囲にクランプ（これで枠外を指しても端に吸着する）
        const u = Math.max(0, Math.min(1, res.x));
        const v = Math.max(0, Math.min(1, res.y));

        return {
            yuki: Math.round(v * config.totalYuki),
            hane: Math.round(u * config.totalHane),
            u, v // 0.0~1.0の正規化座標
        };
    }, [hMatrix, config]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image || !invHMatrix) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            // 図面の比率に合わせてCanvasのサイズを決定
            const canvasW = 800; 
            const canvasH = Math.round(800 * (config.totalYuki / config.totalHane || 1));
            canvas.width = canvasW;
            canvas.height = canvasH;

            // 1. 真っ暗な背景を塗る
            ctx.fillStyle = '#222';
            ctx.fillRect(0, 0, canvasW, canvasH);

            // 2. 射影変換描画 (ピクセルマッピング)
            // 高速化のため、実際にはImageDataを直接操作します
            const outData = ctx.createImageData(canvasW, canvasH);
            
            // 元画像のピクセルデータを取得するためのテンポラリキャンバス
            const tCanvas = document.createElement('canvas');
            tCanvas.width = img.width;
            tCanvas.height = img.height;
            const tCtx = tCanvas.getContext('2d');
            if (!tCtx) return;
            tCtx.drawImage(img, 0, 0);
            const inData = tCtx.getImageData(0, 0, img.width, img.height).data;

            // 補正後のキャンバスの全ピクセルに対して、元の画像のどこを拾うべきか逆算
            for (let y = 0; y < canvasH; y++) {
                for (let x = 0; x < canvasW; x++) {
                    // 0~1の正規化座標に直してから逆行列を適用
                    const srcPos = transformPoint(x / canvasW, y / canvasH, invHMatrix);
                    
                    const sx = Math.floor(srcPos.x * img.width);
                    const sy = Math.floor(srcPos.y * img.height);

                    if (sx >= 0 && sx < img.width && sy >= 0 && sy < img.height) {
                        const outIdx = (y * canvasW + x) * 4;
                        const inIdx = (sy * img.width + sx) * 4;
                        outData.data[outIdx] = inData[inIdx];     // R
                        outData.data[outIdx+1] = inData[inIdx+1]; // G
                        outData.data[outIdx+2] = inData[inIdx+2]; // B
                        outData.data[outIdx+3] = 255;             // A
                    }
                }
            }
            ctx.putImageData(outData, 0, 0);

            // 3. ガイド線とマーカーの描画 (補正後の座標系なのでシンプル！)
            ctx.save();
            markers.forEach((m, idx) => {
                ctx.fillStyle = '#ffeb3b';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(m.x * canvasW, m.y * canvasH, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });

            if (draggingPos) {
                const res = calculateYukiHane(draggingPos.x, draggingPos.y);
                if (res) {
                    const px = res.u * canvasW;
                    const py = res.v * canvasH;
                    ctx.strokeStyle = '#00e5ff';
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.moveTo(px, 0); ctx.lineTo(px, canvasH);
                    ctx.moveTo(0, py); ctx.lineTo(canvasW, py);
                    ctx.stroke();
                }
            }
            ctx.restore();
        };
        img.src = image;
    }, [image, invHMatrix, markers, draggingPos, calculateYukiHane, config]);

    useEffect(() => { draw(); }, [draw]);

    // Canvas上の座標を 0~1 に変換
    const getPos = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) / rect.width,
            y: (clientY - rect.top) / rect.height
        };
    };

    const handleStart = (e: any) => setDraggingPos(getPos(e));
    const handleMove = (e: any) => draggingPos && setDraggingPos(getPos(e));
    const handleEnd = () => {
        if (draggingPos) {
            const res = calculateYukiHane(draggingPos.x, draggingPos.y);
            if (res) {
                setMarkers([...markers, { 
                    yuki: res.yuki, 
                    hane: res.hane, 
                    x: res.u, 
                    y: res.v 
                }]);
            }
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
