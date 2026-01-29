import { useRef, useEffect, useState, useCallback } from 'react';
import { Box, Button, Typography, Paper, Divider, TextField, List, ListItem, ListItemText, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useKasuriContext } from '../contexts/KasuriProvider';

export default function MeasurementStep() {
    const { image, points, config, setConfig, setStep, isPortrait } = useKasuriContext();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const [markers, setMarkers] = useState<{ yuki: number, hane: number, x: number, y: number }[]>([]);
    const [draggingPos, setDraggingPos] = useState<{ x: number, y: number } | null>(null);

    // 座標から「往・羽」を計算（枠内にはみ出さないようにクランプ）
    const calculateYukiHane = useCallback((x: number, y: number) => {
        // 四隅の平均から簡易的な矩形範囲を算出
        const topY = (points[0].y + points[1].y) / 2;
        const bottomY = (points[2].y + points[3].y) / 2;
        const leftX = (points[0].x + points[3].x) / 2;
        const rightX = (points[1].x + points[2].x) / 2;

        // 枠内での比率を計算し、0.0〜1.0の間に強制的に収める（ここが重要！）
        const rawYRate = (y - topY) / (bottomY - topY);
        const rawXRate = (x - leftX) / (rightX - leftX);
        const yRate = Math.max(0, Math.min(1, rawYRate));
        const xRate = Math.max(0, Math.min(1, rawXRate));

        return {
            yuki: Math.round(yRate * config.totalYuki),
            hane: Math.round(xRate * config.totalHane),
            // 描画用に、クランプされた座標も返す
            clampedX: leftX + xRate * (rightX - leftX),
            clampedY: topY + yRate * (bottomY - topY)
        };
    }, [points, config]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // 1. Step 2 の枠線を細く表示（rgbaのaを下げて邪魔しない程度に）
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
            points.forEach(p => ctx.lineTo(p.x * canvas.width, p.y * canvas.height));
            ctx.closePath();
            ctx.stroke();

            // 2. 保存済みのマーカー
            markers.forEach((m, idx) => {
                ctx.fillStyle = '#ffeb3b';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(m.x * canvas.width, m.y * canvas.height, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });

            // 3. ドラッグ中の線と点（枠内クランプ版）
            if (draggingPos) {
                const calc = calculateYukiHane(draggingPos.x, draggingPos.y);
                const px = calc.clampedX * canvas.width;
                const py = calc.clampedY * canvas.height;

                ctx.strokeStyle = '#00e5ff';
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height);
                ctx.moveTo(0, py); ctx.lineTo(canvas.width, py);
                ctx.stroke();
                ctx.setLineDash([]);
                
                ctx.fillStyle = '#00e5ff';
                ctx.beginPath();
                ctx.arc(px, py, 12, 0, Math.PI * 2);
                ctx.fill();
            }
        };
        img.src = image;
    }, [image, points, markers, draggingPos, calculateYukiHane]);

    useEffect(() => { draw(); }, [draw]);

    const getPos = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width) / canvas.width,
            y: (clientY - rect.top) * (canvas.height / rect.height) / canvas.height
        };
    };

    const handleStart = (e: any) => setDraggingPos(getPos(e));
    const handleMove = (e: any) => draggingPos && setDraggingPos(getPos(e));
    const handleEnd = () => {
        if (draggingPos) {
            const res = calculateYukiHane(draggingPos.x, draggingPos.y);
            // 実際に保存する点も、クランプされた位置にする
            setMarkers([...markers, { 
                yuki: res.yuki, 
                hane: res.hane, 
                x: res.clampedX, 
                y: res.clampedY 
            }]);
            setDraggingPos(null);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: isPortrait ? 'column' : 'row', height: '100%', p: 2, gap: 2, boxSizing: 'border-box' }}>
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Typography variant="h6" sx={{ textAlign: 'center', mb: 1, fontWeight: 'bold' }}>
                    図面をなぞって計測
                </Typography>
                <Box sx={{ flexGrow: 1, bgcolor: '#222', borderRadius: '12px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: 'inset 0 0 10px #000' }}>
                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd}
                        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', touchAction: 'none' }}
                    />
                </Box>
            </Box>

            <Box sx={{ width: isPortrait ? '100%' : '320px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
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
                                    primary={`${i + 1}点目: ${m.yuki}往 / ${m.hane}羽`} 
                                    secondary={`位置: ${Math.round(m.x * 100)}%, ${Math.round(m.y * 100)}%`}
                                />
                            </ListItem>
                        ))}
                    </List>
                </Paper>

                <Button fullWidth variant="outlined" onClick={() => setStep(1)} sx={{ borderRadius: '8px' }}>
                    四隅を調整し直す
                </Button>
            </Box>
        </Box>
    );
}
