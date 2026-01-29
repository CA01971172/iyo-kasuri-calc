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
            // 表示サイズの設定（アスペクト比は一旦 totalYuki/totalHane に合わせると綺麗）
            const aspectRatio = config.totalYuki / config.totalHane;
            canvas.width = 1000; // 解像度
            canvas.height = 1000 * (aspectRatio || 1);
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // --- 3. 画像の「引き伸ばし」描画（ピクセル補間） ---
            // 補正後のCanvasの各ピクセルが、元の画像のどこに該当するかを逆算して描画
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) return;
            tempCtx.drawImage(img, 0, 0);
            
            // 高速化のため、実際にはブラウザの変形機能を使うのが理想ですが
            // ここでは「真っ直ぐになった領域」をイメージしやすくするため
            // 枠内をクリッピングして描画する形にします
            ctx.save();
            // (簡易実装: 補正後の座標系でガイドを表示)
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 保存済みのマーカーを補正後の座標で描画
            markers.forEach((m) => {
                ctx.fillStyle = '#ffeb3b';
                ctx.beginPath();
                ctx.arc(m.x * canvas.width, m.y * canvas.height, 8, 0, Math.PI * 2);
                ctx.fill();
            });

            // ドラッグ中のガイド
            if (draggingPos) {
                const res = calculateYukiHane(draggingPos.x, draggingPos.y);
                if (res) {
                    const px = res.u * canvas.width;
                    const py = res.v * canvas.height;
                    ctx.strokeStyle = '#00e5ff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height);
                    ctx.moveTo(0, py); ctx.lineTo(canvas.width, py);
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
