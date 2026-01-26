import { useRef } from 'react';
// 型のみのインポートは 'import type' を使用する
import type { ChangeEvent } from 'react';
import { Button, Box, Typography } from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import { useKasuriContext } from './contexts/KasuriProvider';

export default function PhotoUploader() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { image, setImage } = useKasuriContext();

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        const imageUrl = URL.createObjectURL(file);
        setImage(imageUrl);

        const img = new Image();
        img.onload = function () {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // 1. 内部解像度は「そのまま（高画質）」にする
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // 2. この高画質な「生データ」をContextに保存する
            // ただし、あまりに巨大だとメモリが厳しいので jpeg で圧縮するのがコツ
            // const highResData = canvas.toDataURL('image/jpeg', 0.9);
            // setContextImage(highResData);
        };
        img.src = imageUrl;
    }

    function triggerFileInput() {
        fileInputRef.current?.click();
    }

    return (
        <Box sx={{ textAlign: 'center', p: 2 }}>
            {!image && (
                <Box sx={{ mt: 10 }}>
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                        図面を撮影してください
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        color="primary"
                        startIcon={<PhotoCamera />}
                        onClick={triggerFileInput}
                        sx={{ 
                            width: 300, 
                            height: 100, 
                            fontSize: '1.8rem',
                            borderRadius: '16px',
                            boxShadow: 4
                        }}
                    >
                        写真を撮る
                    </Button>
                </Box>
            )}

            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            <Box sx={{ mt: 2, position: 'relative', overflow: 'hidden' }}>
                <canvas
                    ref={canvasRef}
                    style={{
                        width: '100%',      // 画面の横幅いっぱいに収める
                        height: 'auto',     // 縦横比を維持
                        maxHeight: '70vh',  // 縦に長くなりすぎないよう制限
                        objectFit: 'contain', 
                        cursor: 'zoom-in'   // 「拡大できるよ」という合図
                    }}
                />
            </Box>

            {image && (
                <Box sx={{ mt: 3 }}>
                    <Button 
                        variant="outlined" 
                        size="large" 
                        onClick={triggerFileInput}
                        sx={{ fontSize: '1.2rem' }}
                    >
                        別の写真を撮る
                    </Button>
                </Box>
            )}
        </Box>
    );
}
