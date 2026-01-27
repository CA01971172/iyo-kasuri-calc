import { useRef, useEffect, useState } from 'react';
import { Box, Button, Typography, useMediaQuery } from '@mui/material';
import { useKasuriContext } from '../contexts/KasuriProvider';

export default function Calibration() {
    const isPortrait = useMediaQuery('(orientation: portrait)');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { image, setStep } = useKasuriContext();

    // 線の位置（画像に対する比率 0〜1 で持つと、画面サイズが変わってもズレません）
    const [lineA, setLineA] = useState(0.2); // 0往用（上）
    const [lineB, setLineB] = useState(0.8); // 最大往用（下）

    // 初期描画：画像をCanvasにセット
    useEffect(() => {
        if (!image) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            draw(ctx, img);
        };
        img.src = image;
    }, [image, lineA, lineB]);

    // 描画ロジック
    const draw = (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => {
        const { width, height } = ctx.canvas;
        ctx.clearRect(0, 0, width, height);
        
        // 1. 背景の図面を描画
        ctx.drawImage(img, 0, 0);

        // 2. ガイド線のスタイル設定
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = Math.max(width, height) * 0.005; // 画像サイズに応じて線の太さを調整
        
        // 線A（0往）の描画
        ctx.beginPath();
        ctx.moveTo(0, height * lineA);
        ctx.lineTo(width, height * lineA);
        ctx.stroke();

        // 線B（最大往）の描画
        ctx.beginPath();
        ctx.moveTo(0, height * lineB);
        ctx.lineTo(width, height * lineB);
        ctx.stroke();
    };

    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: isPortrait ? 'column' : 'row', 
            height: '100%', 
            p: 2, 
            gap: 2,
            boxSizing: 'border-box' 
        }}>
            {/* 左/上：メイン操作エリア */}
            <Box sx={{ 
                flexGrow: 1, 
                display: 'flex', 
                flexDirection: 'column',
                minHeight: 0 
            }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1, textAlign: 'center' }}>
                    赤い線を、図面の上下の端に合わせてください
                </Typography>
                
                <Box sx={{ flexGrow: 1, position: 'relative', minHeight: 0, display: 'flex', justifyContent: 'center' }}>
                    {/* ここにCanvasを配置 */}
                    <canvas
                        ref={canvasRef}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            touchAction: 'none', // ブラウザのスクロールを止めてドラッグに集中
                            cursor: 'ns-resize'
                        }}
                    />
                </Box>
            </Box>

            {/* 右/下：操作パネル */}
            <Box sx={{ 
                display: 'flex', 
                // 横持ちの時はボタンを縦に並べてサイドに固定
                flexDirection: 'column', 
                justifyContent: 'center',
                gap: 2,
                width: isPortrait ? '100%' : '240px',
                pb: isPortrait ? 2 : 0,
                flexShrink: 0
            }}>
                <Button 
                    variant="contained" 
                    size="large" 
                    fullWidth 
                    onClick={() => setStep(2)}
                    sx={{
                        fontSize: '1.5rem', 
                        py: isPortrait ? 2 : 4,
                        borderRadius: '12px'
                    }}
                >
                    決定
                </Button>
                <Button 
                    variant="outlined" 
                    onClick={() => setStep(0)}
                    sx={{ 
                        fontSize: '1.1rem', 
                        py: 1,
                    }}
                >
                    前に戻る<br/>(写真を撮り直す)
                </Button>
            </Box>
        </Box>
    );
}
