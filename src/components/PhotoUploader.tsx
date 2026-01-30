import { useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Button, Box, Typography } from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import { useKasuriContext } from '../contexts/KasuriProvider';
import { loadJsonFile } from '../utils/fileHandler';

export default function PhotoUploader() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { image, step, setConfig, setStep, isPortrait, setImage, setPoints, setMarkers } = useKasuriContext();

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

    // データのインポート処理
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const data = await loadJsonFile(file);
            
            // Contextの状態を一気に復元
            if (data.image) setImage(data.image);
            if (data.points) setPoints(data.points);
            if (data.config) setConfig(data.config);
            if (data.markers) setMarkers(data.markers); // ContextにsetMarkersがある前提
            
            // 全て揃っていれば計測画面(Step 3)へ直接ジャンプ
            setStep(2);
        } catch (err) {
            alert("ファイルの読み込みに失敗しました。正しいJSONファイルを選択してください。");
        }
    };

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
                        <Box sx={{ mt: 4 }}>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                保存したデータがある場合はこちら
                            </Typography>
                            <Button
                                variant="outlined"
                                component="label" // buttonをlabelとして扱い、中のinputに反応させる
                                sx={{ width: 200 }}
                            >
                                続きから再開
                                <input type="file" accept=".json" hidden onChange={handleImport} />
                            </Button>
                        </Box>
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
                    <Button
                        fullWidth
                        variant="text" // 他のボタンより少し控えめにして、間違えて押さないようにします
                        component="label"
                        sx={{ 
                            fontSize: '0.9rem', 
                            color: 'text.secondary',
                            textDecoration: 'underline'
                        }}
                    >
                        データを読み込む(続きから再開)
                        <input type="file" accept=".json" hidden onChange={handleImport} />
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
