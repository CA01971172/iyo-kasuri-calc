import { useRef, useEffect, useState, useCallback } from 'react';
import { Box, Button, Typography, Paper, Divider, TextField } from '@mui/material';
import { useKasuriContext } from '../contexts/KasuriProvider';

export default function MeasurementStep() {
    const { image, points, config, setConfig, setStep, isPortrait } = useKasuriContext();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // 現在指している（タップした）位置の状態
    const [currentPos, setCurrentPos] = useState<{ x: number, y: number } | null>(null);
    const [result, setResult] = useState<{ yuki: number, hane: number } | null>(null);

    // 描画処理：画像を真っ直ぐに補正して表示する（簡易版：今は枠内をメインに描画）
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            // ここでは一旦、全体の画像を表示し、その上に計測用のUIを重ねます
            // 本来はここで射影変換（パース補正）を行いますが、まずはレイアウトと計測ロジックを優先します
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // 計測用のガイドラインや、タップした位置のマーカーを描画
            if (currentPos) {
                const px = currentPos.x * canvas.width;
                const py = currentPos.y * canvas.height;

                // 十字線（ターゲット）
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height);
                ctx.moveTo(0, py); ctx.lineTo(canvas.width, py);
                ctx.stroke();

                // タップ位置のドット
                ctx.fillStyle = '#00e5ff';
                ctx.beginPath();
                ctx.arc(px, py, 10, 0, Math.PI * 2);
                ctx.fill();
            }
        };
        img.src = image;
    }, [image, currentPos]);

    useEffect(() => {
        draw();
    }, [draw]);

    // タップ・クリックイベント
    const handleCanvasClick = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const x = (clientX - rect.left) * scaleX / canvas.width;
        const y = (clientY - rect.top) * scaleY / canvas.height;

        setCurrentPos({ x, y });

        // --- 計測計算ロジック ---
        // 4点枠（points）に対して、クリックした座標が相対的にどこにあるかを計算
        // （簡易的な線形補完：本来は射影変換の逆行列を使いますが、まずは直感的な比率で計算）
        const topY = (points[0].y + points[1].y) / 2;
        const bottomY = (points[2].y + points[3].y) / 2;
        const leftX = (points[0].x + points[3].x) / 2;
        const rightX = (points[1].x + points[2].x) / 2;

        const yRate = (y - topY) / (bottomY - topY);
        const xRate = (x - leftX) / (rightX - leftX);

        // totalを掛けて、整数に丸める
        setResult({
            yuki: Math.round(Math.max(0, Math.min(1, yRate)) * config.totalYuki),
            hane: Math.round(Math.max(0, Math.min(1, xRate)) * config.totalHane)
        });
    };

    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: isPortrait ? 'column' : 'row', 
            height: '100%', p: 2, gap: 2, boxSizing: 'border-box' 
        }}>
            {/* 左：メインエリア */}
            <Box sx={{ 
                flexGrow: 1, display: 'flex', flexDirection: 'column', 
                minHeight: 0, minWidth: 0 
            }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, textAlign: 'center' }}>
                    図面をタップして測る
                </Typography>
                <Box sx={{ 
                    flexGrow: 1, display: 'flex', justifyContent: 'center', 
                    alignItems: 'center', minHeight: 0, bgcolor: '#333', borderRadius: '8px', overflow: 'hidden'
                }}>
                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleCanvasClick}
                        onTouchStart={handleCanvasClick}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                </Box>
            </Box>

            {/* 右：サイドパネル */}
            <Box sx={{ 
                width: isPortrait ? '100%' : '300px', 
                display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 
            }}>
                <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>図面の設定</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="総往数（縦の行数）"
                            type="number"
                            value={config.totalYuki}
                            onChange={(e) => setConfig({ ...config, totalYuki: Number(e.target.value) })}
                            size="small"
                        />
                        <TextField
                            label="総羽数（横の幅）"
                            type="number"
                            value={config.totalHane}
                            onChange={(e) => setConfig({ ...config, totalHane: Number(e.target.value) })}
                            size="small"
                        />
                    </Box>
                </Paper>

                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#e3f2fd', borderRadius: '16px' }}>
                    <Typography variant="body2" color="textSecondary">計測値</Typography>
                    <Box sx={{ my: 1 }}>
                        <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                            {result ? result.yuki : '--'} <small style={{ fontSize: '1rem' }}>往</small>
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1976d2', opacity: 0.8 }}>
                            {result ? result.hane : '--'} <small style={{ fontSize: '1rem' }}>羽</small>
                        </Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="textSecondary">
                        タップした場所の行と羽を表示中
                    </Typography>
                </Paper>

                <Box sx={{ flexGrow: 1 }} />

                <Button 
                    fullWidth variant="outlined" 
                    onClick={() => setStep(1)}
                    sx={{ py: 1 }}
                >
                    四隅の調整に戻る
                </Button>
            </Box>
        </Box>
    );
}
