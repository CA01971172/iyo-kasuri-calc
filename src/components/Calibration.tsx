import { useRef, useEffect, useState, useCallback } from 'react';
import { Box, Button, Typography, useMediaQuery } from '@mui/material';
import { useKasuriContext } from '../contexts/KasuriProvider';

export default function CalibrationStep() {
    const isPortrait = useMediaQuery('(orientation: portrait)');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { image, setStep, points, setPoints } = useKasuriContext();
    const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

    // 描画処理
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 1. 背景画像
            ctx.drawImage(img, 0, 0);

            // 2. 4点を結ぶ枠線
            ctx.strokeStyle = draggingIdx !== null ? 'rgba(255, 0, 0, 0.3)' : 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = canvas.width * 0.005;
            ctx.beginPath();
            ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
            points.forEach((p) => {
                ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
            });
            ctx.closePath();
            ctx.stroke();

            // 3. 各点の「つまみ（ハンドル）」
            points.forEach((p, i) => {
                const px = p.x * canvas.width;
                const py = p.y * canvas.height;
                const isDragging = i === draggingIdx;

                // 1. 【大きい透明な点】指を受け止めるエリア
                ctx.beginPath();
                ctx.arc(px, py, canvas.width * 0.02, 0, Math.PI * 2);
                ctx.fillStyle = isDragging ? 'rgba(255, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
                ctx.fill();

                // 2. 【小さい不透明な点】角に合わせるための精密な中心
                ctx.beginPath();
                ctx.arc(px, py, canvas.width * 0.005, 0, Math.PI * 2);
                ctx.fillStyle = '#ff0000'; // ここはパキッと不透明
                ctx.fill();
                
                // 3. 【おまけ】白い縁取り
                // 背景が黒い影（image_9150d9.pngの端など）でも中心が見えるように、
                // 小さい点の周りに細く白い線を引くと、どんな画像でも埋もれません
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
            
        };
        img.src = image;
    }, [image, points, draggingIdx]);

    useEffect(() => {
        draw();
    }, [draw]);

    // 座標取得用
    const getPos = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        // イベントがマウスかタッチか判定
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX / canvas.width,
            y: (clientY - rect.top) * scaleY / canvas.height
        };
    };

    const handleStart = (e: any) => {
        const pos = getPos(e);
        // 一番近い点を探す
        let closestIdx = -1;
        let minDist = 0.05; // 判定距離（比率）
        points.forEach((p, i) => {
            const d = Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2);
            if (d < minDist) {
                minDist = d;
                closestIdx = i;
            }
        });
        if (closestIdx !== -1) setDraggingIdx(closestIdx);
    };

    const handleMove = (e: any) => {
        if (draggingIdx === null) return;
        const pos = getPos(e);
        const newPoints = [...points];
        newPoints[draggingIdx] = { 
            x: Math.max(0, Math.min(1, pos.x)), 
            y: Math.max(0, Math.min(1, pos.y)) 
        };
        setPoints(newPoints);
    };

    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: isPortrait ? 'column' : 'row', 
            height: '100%', p: 2, gap: 2, boxSizing: 'border-box' 
        }}>
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 0, minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center', color: 'black' }}>
                    図面の四隅に赤い点を合わせてください
                </Typography>
                
                <Box sx={{ flexGrow: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleStart}
                        onMouseMove={handleMove}
                        onMouseUp={() => setDraggingIdx(null)}
                        onTouchStart={handleStart}
                        onTouchMove={handleMove}
                        onTouchEnd={() => setDraggingIdx(null)}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            touchAction: 'none',
                            cursor: draggingIdx !== null ? 'grabbing' : 'crosshair',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                        }}
                    />
                </Box>
            </Box>

            {/* 操作ボタン：PhotoUploaderとサイズ・トーンを統一 */}
            <Box sx={{ 
                display: 'flex', flexDirection: 'column', justifyContent: 'center', 
                gap: 2, width: isPortrait ? '100%' : '240px', flexShrink: 0 
            }}>
                <Button 
                    fullWidth variant="contained" color="primary"
                    onClick={() => setStep(2)}
                    sx={{ fontSize: '1.5rem', py: isPortrait ? 2 : 4, borderRadius: '12px' }}
                >
                    次へ進む
                </Button>
                <Button 
                    fullWidth variant="outlined" 
                    onClick={() => setStep(0)}
                    sx={{ fontSize: '1.1rem', py: 1 }}
                >
                    前に戻る<br/>(写真を撮り直す)
                </Button>
            </Box>
        </Box>
    );
}
