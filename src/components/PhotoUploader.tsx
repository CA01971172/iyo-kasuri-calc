import { useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Button, Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import { useKasuriContext } from '../contexts/KasuriProvider';

export default function PhotoUploader() {
    // 縦長(Portrait)判定：PCブラウザを細長くしても反応します
    const isPortrait = useMediaQuery('(orientation: portrait)');
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { image, setImage, step, setStep } = useKasuriContext();

    // 初期描画：既に画像がある場合にCanvasにセット
    useEffect(() => {
        // 画像がない、またはCanvasの準備ができていない場合は何もしない
        if (!image) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            // Contextにある画像の解像度に合わせてCanvasをリサイズして描画
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
        };
        img.src = image; // 既に保持している dataURL を流し込む

    }, [image, step]); // imageが変わった時や、ステップが戻ってきた時に発火

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        const imageUrl = URL.createObjectURL(file);
        // コンテキストとプレビュー表示の両方にセット
        setImage(imageUrl);

        const img = new Image();
        img.onload = function () {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // 内部解像度は高画質のまま保持
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // 高画質なjpegデータとして保存（メモリに配慮しつつ品質維持）
            const highResData = canvas.toDataURL('image/jpeg', 0.8);
            setImage(highResData);
        };
        img.src = imageUrl;
    }

    function triggerFileInput() {
        fileInputRef.current?.click();
    }

    return (
        <Box sx={{ 
            display: 'flex', 
            // 縦なら上下、横なら左右に並べる
            flexDirection: isPortrait ? 'column' : 'row', 
            height: '100%', 
            p: 2,
            gap: 2,
            boxSizing: 'border-box',
            transition: 'all 0.3s ease'
        }}>
            {/* メインコンテンツエリア：写真または撮影ボタン */}
            <Box sx={{ 
                flexGrow: 1, 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 0,
                minWidth: 0
            }}>
                {image && (
                    <Typography 
                        variant="h5" 
                        sx={{ 
                            fontWeight: 'bold', 
                            mb: 2, 
                            textAlign: 'center' 
                        }}
                    >
                        この写真で図面を測りますか？
                    </Typography>
                )}

                {!image ? (
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 4 }}>
                            図面を撮影してください
                        </Typography>
                        <Button
                            variant="contained"
                            onClick={triggerFileInput}
                            startIcon={<PhotoCamera />}
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
                ) : (
                    <Box sx={{
                        flexGrow: 1,
                        minHeight: 0
                    }}>
                        <canvas
                            ref={canvasRef}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                // TODO: 縦幅制限をもう少しスマートに
                                // maxHeight: isPortrait ? '70vh' : '100%', // 向きに合わせて最大サイズを調整
                                objectFit: 'contain',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                            }}
                        />
                    </Box>
                )}
            </Box>

            {/* 操作ボタンエリア：決定・撮り直し */}
            {image && (
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
                        fullWidth
                        variant="contained" 
                        color="primary"
                        onClick={() => setStep(1)}
                        sx={{ 
                            fontSize: '1.5rem', 
                            py: isPortrait ? 2 : 4,
                            borderRadius: '12px'
                        }}
                    >
                        決定
                    </Button>
                    <Button 
                        fullWidth
                        variant="outlined" 
                        onClick={triggerFileInput}
                        sx={{ 
                            fontSize: '1.1rem', 
                            py: 1,
                        }}
                    >
                        写真を撮り直す
                    </Button>
                </Box>
            )}

            {/* 隠しinput */}
            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />
        </Box>
    );
}
