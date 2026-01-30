import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Button, Typography, Paper, Divider, List, ListItem, ListItemText, IconButton, ToggleButton, ToggleButtonGroup } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PanToolIcon from '@mui/icons-material/PanTool'; 
import AddLocationIcon from '@mui/icons-material/AddLocation'; 
import { useKasuriContext } from '../contexts/KasuriProvider';
import { getHomographyMatrix, transformPoint } from '../utils/homography';
import { saveJsonFile, loadJsonFile } from '../utils/fileHandler';
import { exportToPdf } from '../utils/pdfExporter';

export default function MeasurementStep() {
    const { image, setImage, points, setPoints, config, setConfig, setStep, isPortrait, markers, setMarkers } = useKasuriContext();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cacheCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);

    const [draggingPos, setDraggingPos] = useState<{ x: number, y: number } | null>(null);
    const [magnifierPos, setMagnifierPos] = useState<{ x: number, y: number } | null>(null);

    const [mode, setMode] = useState<'measure' | 'pan'>('measure'); 
    const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 }); 
    const [lastTouch, setLastTouch] = useState<{ x: number, y: number } | null>(null); 

    const rectRatio = useMemo(() => {
        const topW = Math.sqrt(Math.pow(points[1].x - points[0].x, 2) + Math.pow(points[1].y - points[0].y, 2));
        const bottomW = Math.sqrt(Math.pow(points[2].x - points[3].x, 2) + Math.pow(points[2].y - points[3].y, 2));
        const leftH = Math.sqrt(Math.pow(points[3].x - points[0].x, 2) + Math.pow(points[3].y - points[0].y, 2));
        const rightH = Math.sqrt(Math.pow(points[2].x - points[1].x, 2) + Math.pow(points[2].y - points[1].y, 2));
        return ((topW + bottomW) / 2) / ((leftH + rightH) / 2);
    }, [points]);

    const invHMatrix = useMemo(() => {
        const dst = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
        return getHomographyMatrix(dst, points);
    }, [points]);

    const generateCache = useCallback(() => {
        if (!image || !invHMatrix) return;
        const img = new Image();
        img.onload = () => {
            const canvasW = 800;
            const canvasH = Math.round(800 / rectRatio);
            const cCanvas = document.createElement('canvas');
            cCanvas.width = canvasW; cCanvas.height = canvasH;
            const cCtx = cCanvas.getContext('2d');
            if (!cCtx) return;

            const tCanvas = document.createElement('canvas');
            tCanvas.width = img.width; tCanvas.height = img.height;
            const tCtx = tCanvas.getContext('2d');
            if (!tCtx) return;
            tCtx.drawImage(img, 0, 0);
            const inData = tCtx.getImageData(0, 0, img.width, img.height).data;
            const outData = cCtx.createImageData(canvasW, canvasH);

            for (let y = 0; y < canvasH; y++) {
                for (let x = 0; x < canvasW; x++) {
                    const srcPos = transformPoint(x / canvasW, y / canvasH, invHMatrix);
                    const sx = Math.floor(srcPos.x * img.width);
                    const sy = Math.floor(srcPos.y * img.height);
                    if (sx >= 0 && sx < img.width && sy >= 0 && sy < img.height) {
                        const outIdx = (y * canvasW + x) * 4;
                        const inIdx = (sy * img.width + sx) * 4;
                        outData.data[outIdx] = inData[inIdx];
                        outData.data[outIdx+1] = inData[inIdx+1];
                        outData.data[outIdx+2] = inData[inIdx+2];
                        outData.data[outIdx+3] = 255;
                    }
                }
            }
            cCtx.putImageData(outData, 0, 0);
            cacheCanvasRef.current = cCanvas;
            draw();
        };
        img.src = image;
    }, [image, invHMatrix, rectRatio]);

    useEffect(() => { generateCache(); }, [generateCache]);

    // --- 3. 描画関数（黒い余白をCanvas内で制御する） ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const cache = cacheCanvasRef.current;
        if (!canvas || !cache) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Canvasの解像度をコンテナの表示サイズに合わせる（ボケ防止）
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();

        // 1. 画像をCanvasに収めるためのベース倍率と中央寄せ（黒い余白の計算）
        const scaleFit = Math.min(canvas.width / cache.width, canvas.height / cache.height);
        const offsetX = (canvas.width - cache.width * scaleFit) / 2;
        const offsetY = (canvas.height - cache.height * scaleFit) / 2;

        // 2. ズーム・移動の適用
        // 移動量は拡大率に合わせてスケーリングして、直感的な操作感に
        ctx.translate(offsetX + zoom.x, offsetY + zoom.y);
        ctx.scale(scaleFit * zoom.scale, scaleFit * zoom.scale);

        ctx.drawImage(cache, 0, 0);

        // マーカー描画
        markers.forEach(m => {
            // 画面上の見た目を「半径3px」くらいに固定
            const r = 3 / (scaleFit * zoom.scale); 
            ctx.fillStyle = '#ffff00';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1 / (scaleFit * zoom.scale);
            
            ctx.beginPath();
            ctx.arc(m.x * cache.width, m.y * cache.height, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });

        // 十字線ガイド
        if (draggingPos) {
            const px = draggingPos.x * cache.width;
            const py = draggingPos.y * cache.height;
            
            // 枠線の色 (mode が measure なら赤) と合わせる
            ctx.strokeStyle = mode === 'measure' ? '#ff4444' : '#4488ff'; 
            ctx.lineWidth = 1 / (scaleFit * zoom.scale);
            
            // 少し透けさせると、下の画像（絣の糸）が見やすくなって親切です
            ctx.globalAlpha = 0.7; 
            ctx.setLineDash([5 / (scaleFit * zoom.scale), 5 / (scaleFit * zoom.scale)]);
            
            ctx.beginPath();
            ctx.moveTo(px, 0); ctx.lineTo(px, cache.height);
            ctx.moveTo(0, py); ctx.lineTo(cache.width, py);
            ctx.stroke();
            
            ctx.globalAlpha = 1.0; // 元に戻す
        }
        ctx.restore();
    }, [markers, draggingPos, zoom]);

    useEffect(() => { draw(); }, [draw]);

    // --- 4. 座標取得（黒い余白とズームを逆算） ---
    const getPos = (e: any) => {
        const canvas = canvasRef.current;
        const cache = cacheCanvasRef.current;
        if (!canvas || !cache) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Canvas内の相対位置
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;

        // drawと同じ「ベースの余白」を計算
        const scaleFit = Math.min(rect.width / cache.width, rect.height / cache.height);
        const offsetX = (rect.width - cache.width * scaleFit) / 2;
        const offsetY = (rect.height - cache.height * scaleFit) / 2;

        // ズームと移動を逆算して、画像上のピクセル座標を出す
        const imgPxX = (mouseX - offsetX - zoom.x) / (scaleFit * zoom.scale);
        const imgPxY = (mouseY - offsetY - zoom.y) / (scaleFit * zoom.scale);

        // 0.0 ~ 1.0 の範囲に正規化
        return {
            x: Math.max(0, Math.min(1, imgPxX / cache.width)),
            y: Math.max(0, Math.min(1, imgPxY / cache.height))
        };
    };

    // --- ★追加：中心点固定ズーム ---
    const handleZoomChange = (newScale: number) => {
        setZoom(prev => {
            const canvas = canvasRef.current;
            if (!canvas) return { ...prev, scale: newScale };

            // 画面の中心を基準点にする
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            // 現在の表示で中心にある「画像上の位置」を逆算
            const imageX = (centerX - prev.x) / prev.scale;
            const imageY = (centerY - prev.y) / prev.scale;

            // 新しいスケールで、その画像位置が中心に来るように座標を再計算
            const newX = centerX - imageX * newScale;
            const newY = centerY - imageY * newScale;

            // 移動制限（マスターと決めた「半分まで」の制限）
            const limitX = canvas.width / 2;
            const limitY = canvas.height / 2;

            return {
                scale: newScale,
                x: Math.max(-limitX * newScale, Math.min(limitX, newX)),
                y: Math.max(-limitY * newScale, Math.min(limitY, newY))
            };
        });
    };

    const handleStart = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return; // canvasがない場合は何もしない
        const rect = canvas.getBoundingClientRect();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // ルーペを表示する位置をセット
        const x = (clientX - rect.left - zoom.x) / zoom.scale;
        const y = (clientY - rect.top - zoom.y) / zoom.scale;
        setMagnifierPos({ x, y });

        if (mode === 'pan') {
            setLastTouch({ x: clientX, y: clientY });
        } else {
            setDraggingPos(getPos(e));
        }
    };

    useEffect(() => {
        const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

            // 指が動いている間は常にルーペを表示
            // ★追加：ルーペ用の座標を常に計算してセット
            const currentPos = getPos(e);
            setMagnifierPos(currentPos); // これで 0.0〜1.0 の比率座標が渡る

            if (mode === 'pan' && lastTouch) {
                const dx = clientX - lastTouch.x;
                const dy = clientY - lastTouch.y;

                setZoom(prev => {
                    const newX = prev.x + dx;
                    const newY = prev.y + dy;
                    const limitX = canvas.width / 2;
                    const limitY = canvas.height / 2;
                    return {
                        ...prev,
                        x: Math.max(-limitX * prev.scale, Math.min(limitX, newX)),
                        y: Math.max(-limitY * prev.scale, Math.min(limitY, newY))
                    };
                });
                setLastTouch({ x: clientX, y: clientY });
            } 
            else if (draggingPos) {
                setDraggingPos(currentPos);
            }
        };

        const handleGlobalUp = () => {
            setLastTouch(null);
            setDraggingPos(null);
            setMagnifierPos(null); // ★追加：指を離したらルーペを消す
        };

        // window 全体で監視することで、Canvasの外で離しても反応するようにする
        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('touchmove', handleGlobalMove, { passive: false });
        window.addEventListener('mouseup', handleGlobalUp);
        window.addEventListener('touchend', handleGlobalUp);
        // マウスがブラウザの外に出た時も消す
        window.addEventListener('mouseleave', handleGlobalUp);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('touchmove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalUp);
            window.removeEventListener('touchend', handleGlobalUp);
            window.removeEventListener('mouseleave', handleGlobalUp);
        };
        // 依存配列に zoom.x と zoom.y も追加しておくと座標計算が正確になります
    }, [mode, lastTouch, draggingPos, zoom.scale, zoom.x, zoom.y]);

    const handleEnd = () => {
        if (mode === 'pan') {
            setLastTouch(null);
        } else if (draggingPos) {
            setMarkers([...markers, { 
                yuki: Math.round(draggingPos.y * config.totalYuki), 
                hane: Math.round(draggingPos.x * config.totalHane), 
                x: draggingPos.x, y: draggingPos.y 
            }]);
            setDraggingPos(null);
        }
    };

    // 座標が追加されたら、リスト内だけを一番下へスクロール
    useEffect(() => {
        if (listContainerRef.current) {
            const container = listContainerRef.current;
            // 箱の中身の高さ (scrollHeight) まで、箱のスクロール位置 (scrollTop) を飛ばす
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [markers.length]);

    // データエクスポート処理
    const handleExport = () => {
        const data = {
            image,      // base64画像データ
            points,     // 四隅の座標
            config,     // 総往数・総羽数
            markers,    // 打った点
            version: "1.0"
        };
        const date = new Date().toLocaleDateString().replace(/\//g, '-');
        saveJsonFile(data, `かすり計測保存_${date}.json`);
    };

    // 読み込み処理
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // お祖母様がうっかり今の作業を消さないための確認
        if (markers.length > 0) {
            if (!window.confirm("今の計測データが消えてしまいますが、別のファイルを読み込んでもよろしいですか？")) {
                return;
            }
        }

        try {
            const data = await loadJsonFile(file);
            if (data.image) setImage(data.image);
            if (data.points) setPoints(data.points);
            if (data.config) setConfig(data.config);
            if (data.markers) setMarkers(data.markers);
            // Stepを移動する必要はない（既にStep 2にいるため）が、必要なら強制セット
            setStep(2); 
        } catch (err) {
            alert("読み込みに失敗しました。ファイルを確認してください。");
        }
        // 同じファイルを連続で読み込めるようにinputをリセット
        e.target.value = '';
    };

    // PDF出力実行
    const handlePdfExport = () => {
        if (!image) return;
        exportToPdf(image, markers, config);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: isPortrait ? 'column' : 'row', height: '100%', p: 2, gap: 2, boxSizing: 'border-box' }}>
            <Box sx={{ flexGrow: 2, display: 'flex', flexDirection: 'column', minHeight: isPortrait ? '50vh' : 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 1 }}>
                    <ToggleButtonGroup value={mode} exclusive onChange={(_, m) => m && setMode(m)} size="small" color="primary">
                        <ToggleButton value="measure"><AddLocationIcon sx={{ mr: 1 }}/>計測</ToggleButton>
                        <ToggleButton value="pan"><PanToolIcon sx={{ mr: 1 }}/>移動</ToggleButton>
                    </ToggleButtonGroup>
                    <Divider orientation="vertical" flexItem />
                    <Typography variant="caption">拡大:</Typography>
                    <input 
                        type="range" min="1" max="5" step="0.1" 
                        value={zoom.scale} 
                        // ★修正：中心固定ズーム関数を呼ぶ
                        onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                        style={{ width: '100px' }}
                    />
                    <Button size="small" onClick={() => setZoom({ scale: 1, x: 0, y: 0 })}>リセット</Button>
                </Box>

                <Box sx={{ 
                    flexGrow: 1, 
                    bgcolor: '#222', 
                    borderRadius: '12px', 
                    overflow: 'hidden', 
                    display: 'flex', 
                    position: 'relative',
                    // モードによって枠線の色を変える（計測は赤、移動は青など）
                    border: `4px solid ${mode === 'measure' ? '#ff4444' : '#4488ff'}`,
                    transition: 'border-color 0.2s'
                }}>
                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleStart} 
                        onMouseUp={handleEnd}
                        onTouchStart={handleStart} 
                        onTouchEnd={handleEnd}
                        style={{ 
                            width: '100%', 
                            height: '100%', 
                            touchAction: 'none', 
                            cursor: mode === 'pan' ? 'grab' : 'crosshair',
                            display: 'block' // 余計な隙間を消す
                        }}
                    />
                    <Button 
                        variant="contained" 
                        color="inherit"
                        onClick={() => setMarkers(prev => prev.slice(0, -1))}
                        disabled={markers.length === 0}
                        sx={{ position: 'absolute', top: 10, right: 10, minWidth: '80px', fontWeight: 'bold' }}
                    >
                        一つ戻る
                    </Button>
                </Box>
            </Box>

            {/* ルーペを表示する */}
            {magnifierPos && mode === 'measure' && (
                <Paper
                    elevation={10}
                    sx={{
                        position: 'absolute',
                        top: 20,
                        left: isPortrait ? 20 : 'auto', 
                        right: isPortrait ? 'auto' : 20,
                        width: 160,
                        height: 160,
                        overflow: 'hidden',
                        borderRadius: '50%',
                        border: '4px solid #fff',
                        zIndex: 1000,
                        pointerEvents: 'none',
                    }}
                >
                    <canvas
                        ref={(el) => {
                            if (!el || !cacheCanvasRef.current) return;
                            const ctx = el.getContext('2d');
                            const cacheCanvas = cacheCanvasRef.current;
                            if (!ctx) return;

                            const size = 160;
                            const mag = 1.5; // 一旦1.5倍くらいにしてみます
                            el.width = size;
                            el.height = size;

                            // 補正後画像（cacheCanvas）上でのピクセル座標を計算
                            const sourceX = magnifierPos.x * cacheCanvas.width;
                            const sourceY = magnifierPos.y * cacheCanvas.height;
                            const sourceSize = size / mag;

                            ctx.drawImage(
                                cacheCanvas, // 生画像ではなく補正済みCanvasを使う！
                                sourceX - sourceSize / 2,
                                sourceY - sourceSize / 2,
                                sourceSize,
                                sourceSize,
                                0, 0, size, size
                            );

                            // 中央の照準（赤十字）
                            ctx.strokeStyle = 'red';
                            ctx.lineWidth = 2;
                            ctx.beginPath();
                            ctx.moveTo(size/2 - 15, size/2); ctx.lineTo(size/2 + 15, size/2);
                            ctx.moveTo(size/2, size/2 - 15); ctx.lineTo(size/2, size/2 + 15);
                            ctx.stroke();
                        }}
                    />
                </Paper>
            )}

            {/* 右側（横向き）または下側（縦向き）の操作パネル */}
            <Box
                sx={{
                    width: isPortrait ? '100%' : '300px',
                    // 横向きの時は画面の高さに完全に固定する
                    height: isPortrait ? 'auto' : 'calc(100vh - 60px)', 
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    overflow: 'hidden', // はみ出しを禁止
                }}
            >
                <Paper
                    sx={{
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        // 縦なら300px固定、横なら残りの高さを全部使う
                        height: isPortrait ? '300px' : '100%', 
                        minHeight: 0, // Flexの子要素が親を突き破るのを防ぐ
                        overflow: 'hidden',
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            計測リスト
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button size="small" variant="outlined" onClick={handlePdfExport}>PDF</Button>
                            <Button size="small" variant="contained" onClick={handleExport}>保存</Button>
                        </Box>
                    </Box>

                    <Divider />

                    {/* リストエリア：ここが自律的にスクロールする */}
                    <Box 
                        ref={listContainerRef} // ★ここに追加
                        sx={{ 
                            flexGrow: 1, 
                            overflowY: 'auto', 
                            mt: 1,
                            // スムーズなスクロールを有効にするための指定
                            scrollBehavior: 'smooth',
                            minHeight: 0,
                        }}
                    >
                        <List dense>
                            {markers.map((m, i) => (
                                <ListItem
                                    key={i}
                                    divider
                                    secondaryAction={
                                        <IconButton edge="end" onClick={() => setMarkers(markers.filter((_, idx) => idx !== i))}>
                                            <DeleteIcon />
                                        </IconButton>
                                    }
                                >
                                    <ListItemText primary={`${i + 1}. ${m.yuki} 往 / ${m.hane} 羽`} />
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                </Paper>

                {/* 下部の固定ボタンエリア */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                    <Button fullWidth variant="outlined" onClick={() => setStep(1)}>
                        四隅を調整し直す
                    </Button>
                    <Button
                        fullWidth
                        variant="text"
                        component="label"
                        sx={{ fontSize: '0.8rem', color: 'text.secondary', textDecoration: 'underline' }}
                    >
                        別の保存ファイルを開く
                        <input type="file" accept=".json" hidden onChange={handleImport} />
                    </Button>
                </Box>
            </Box>
        </Box>
    );
}
