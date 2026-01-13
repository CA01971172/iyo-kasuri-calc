import { useState, useRef } from 'react';
// 型のみのインポートは 'import type' を使用する
import type { ChangeEvent } from 'react';
import { Button, Box, Typography } from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';

export default function PhotoUploader() {
    const [image, setImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

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

            // 画像の解像度を維持して描画
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
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
                        maxWidth: '100%',
                        height: 'auto',
                        display: image ? 'block' : 'none',
                        margin: '0 auto',
                        border: '2px solid #333',
                        borderRadius: '8px'
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
