import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Button, Typography, Paper, Divider, TextField, List, ListItem, ListItemText, IconButton, ToggleButton, ToggleButtonGroup } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PanToolIcon from '@mui/icons-material/PanTool'; // 移動用アイコン
import AddLocationIcon from '@mui/icons-material/AddLocation'; // 計測用アイコン
import { useKasuriContext } from '../contexts/KasuriProvider';
import { getHomographyMatrix, transformPoint } from '../utils/homography';

export default function MeasurementStep() {
    const { image, points, config, setConfig, setStep, isPortrait } = useKasuriContext();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cacheCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const listEndRef = useRef<HTMLDivElement>(null);
    
    const [markers, setMarkers] = useState<{ yuki: number, hane: number, x: number, y: number }[]>([]);
    const [draggingPos, setDraggingPos] = useState<{ x: number, y: number } | null>(null);

    // --- ズーム・移動用のState ---
    const [mode, setMode] = useState<'measure' | 'pan'>('measure'); // 操作モード
    const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 }); // 拡大率と表示オフセット
    const [lastTouch, setLastTouch] = useState<{ x: number, y: number } | null>(null); // ドラッグ計算用

    // 1. 赤枠の比率算出（既存の正確なロジックを維持）
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

    // 2. キャッシュ生成（既存ロジック）
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

    // 3. 描画関数（ズーム・移動・十字線をすべて反映）
const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const cache = cacheCanvasRef.current;
        if (!canvas || !cache) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 解像度はキャッシュに合わせる
        canvas.width = cache.width;
        canvas.height = cache.height;

        ctx.save();
        // 移動と拡大を適用
        ctx.translate(zoom.x, zoom.y);
        ctx.scale(zoom.scale, zoom.scale);

        ctx.drawImage(cache, 0, 0);

        // マーカー描画
        markers.forEach(m => {
            ctx.fillStyle = '#ffff00';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.arc(m.x * cache.width, m.y * cache.height, 3 / zoom.scale, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });

        // 十字線ガイド（draggingPosは補正後画像上の 0~1）
        if (draggingPos) {
            const px = draggingPos.x * cache.width;
            const py = draggingPos.y * cache.height;
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 1 / zoom.scale;
            ctx.setLineDash([5 / zoom.scale, 5 / zoom.scale]);
            ctx.beginPath();
            ctx.moveTo(px, 0); ctx.lineTo(px, cache.height);
            ctx.moveTo(0, py); ctx.lineTo(cache.width, py);
            ctx.stroke();
        }
        ctx.restore();
    }, [markers, draggingPos, zoom]);

    useEffect(() => { draw(); }, [draw]);

    // --- 4. 座標取得（完璧な余白計算 ＋ ズーム逆算） ---
    const getPos = (e: any) => {
        const canvas = canvasRef.current;
        const cache = cacheCanvasRef.current;
        if (!canvas || !cache) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // 1. まず「Canvasの表示枠」の中での物理タッチ位置(px)を出す
        const relX = clientX - rect.left;
        const relY = clientY - rect.top;

        // 2. ズームと移動量を逆算して「ズーム前のCanvas座標」に戻す
        // ブラウザ上の1pxをCanvas上の解像度に変換して計算
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const unzoomedX = (relX * scaleX - zoom.x) / zoom.scale;
        const unzoomedY = (relY * scaleY - zoom.y) / zoom.scale;

        // 3. ここから「完璧だった頃の余白計算」を適用
        const containerRatio = canvas.width / canvas.height;
        const contentRatio = cache.width / cache.height;

        let x, y;
        if (containerRatio > contentRatio) {
            // 左右に余白があるケース
            const displayWidth = canvas.height * contentRatio;
            const offsetX = (canvas.width - displayWidth) / 2;
            x = (unzoomedX - offsetX) / displayWidth;
            y = unzoomedY / canvas.height;
        } else {
            // 上下に余白があるケース
            const displayHeight = canvas.width / contentRatio;
            const offsetY = (canvas.height - displayHeight) / 2;
            x = unzoomedX / canvas.width;
            y = (unzoomedY - offsetY) / displayHeight;
        }

        return {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y))
        };
    };

    // 5. ハンドラ（計測と移動の分岐）
    const handleStart = (e: any) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        if (mode === 'pan') {
            setLastTouch({ x: clientX, y: clientY });
        } else {
            setDraggingPos(getPos(e));
        }
    };

    // --- 5. 移動制限（迷子防止）付きハンドラ ---
    // handleMove 内の移動制限ロジックの修正案
    const handleMove = (e: any) => {
        if (mode === 'pan' && lastTouch) {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            const dx = clientX - lastTouch.x;
            const dy = clientY - lastTouch.y;

            setZoom(prev => {
                const newX = prev.x + dx;
                const newY = prev.y + dy;

                // 制限の計算：図面の半分（または任意の値）が画面内に残るように
                // cacheCanvas の解像度に基づいた制限
                const canvas = canvasRef.current;
                if (!canvas) return prev;

                // 画像の端が「画面の中央」を越えないように制限
                // これにより、全域を中央で拡大可能かつ、完全な消失を防ぐ
                const limitX = canvas.width / 2;
                const limitY = canvas.height / 2;

                return {
                    ...prev,
                    x: Math.max(-limitX * prev.scale, Math.min(limitX, newX)),
                    y: Math.max(-limitY * prev.scale, Math.min(limitY, newY))
                };
            });
            setLastTouch({ x: clientX, y: clientY });
        } else if (draggingPos) {
            // 計測モード時のズレ防止：canvas外に出たら一旦 draggingPos を null にするか、端に吸着させる
            const pos = getPos(e);
            setDraggingPos(pos);
        }
    };

    // 2. useEffect を使ってグローバルにイベントを登録
    useEffect(() => {
        const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
            // 移動モード(pan)かつ、ドラッグ中(lastTouchがある)の場合
            if (mode === 'pan' && lastTouch) {
                const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
                const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
                
                const dx = clientX - lastTouch.x;
                const dy = clientY - lastTouch.y;

                setZoom(prev => {
                    const canvas = canvasRef.current;
                    if (!canvas) return prev;

                    const newX = prev.x + dx;
                    const newY = prev.y + dy;

                    // マスターと決めた「画像の端が画面中央を越えない」制限
                    const limitX = canvas.width / 2;
                    const limitY = canvas.height / 2;

                    return {
                        ...prev,
                        x: Math.max(-limitX * prev.scale, Math.min(limitX, newX)),
                        y: Math.max(-limitY * prev.scale, Math.min(limitY, newY))
                    };
                });
                // 常に最新の座標で更新し続けるのでワープしない
                setLastTouch({ x: clientX, y: clientY });
            } 
            // 計測モード中の十字線移動（これは canvas 内にいる時だけでOK）
            else if (draggingPos) {
                setDraggingPos(getPos(e));
            }
        };

        const handleGlobalUp = () => {
            setLastTouch(null);
            setDraggingPos(null);
        };

        // イベントの登録
        window.addEventListener('mousemove', handleGlobalMove);
        window.addEventListener('touchmove', handleGlobalMove, { passive: false });
        window.addEventListener('mouseup', handleGlobalUp);
        window.addEventListener('touchend', handleGlobalUp);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('touchmove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalUp);
            window.removeEventListener('touchend', handleGlobalUp);
        };
    }, [mode, lastTouch, draggingPos, zoom.scale]); // 依存配列に注意

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

    useEffect(() => {
        if (markers.length > 0) listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [markers]);

    return (
        <Box sx={{ display: 'flex', flexDirection: isPortrait ? 'column' : 'row', height: '100%', p: 2, gap: 2, boxSizing: 'border-box' }}>
            <Box sx={{ flexGrow: 2, display: 'flex', flexDirection: 'column', minHeight: isPortrait ? '50vh' : 0 }}>
                {/* ズーム操作UI */}
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
                        onChange={(e) => setZoom(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                        style={{ width: '100px' }}
                    />
                    <Button size="small" onClick={() => setZoom({ scale: 1, x: 0, y: 0 })}>リセット</Button>
                </Box>

                <Box sx={{ flexGrow: 1, bgcolor: '#222', borderRadius: '12px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleStart} onMouseUp={handleEnd}
                        onTouchStart={handleStart} onTouchEnd={handleEnd}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', touchAction: 'none', cursor: mode === 'pan' ? 'grab' : 'crosshair' }}
                    />
                </Box>
            </Box>

            <Box sx={{ width: isPortrait ? '100%' : '320px', height: isPortrait ? '40%' : '100%', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                {/* 設定・リスト・ボタン類は以前の完ぺきなレイアウトを維持 */}
                <Paper sx={{ p: 2, borderRadius: '12px' }}>
                    <Typography variant="subtitle2" gutterBottom color="textSecondary">図面の設定 (total)</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField label="総往数" type="number" value={config.totalYuki} onChange={(e) => setConfig({ ...config, totalYuki: Number(e.target.value) })} fullWidth size="small" />
                        <TextField label="総羽数" type="number" value={config.totalHane} onChange={(e) => setConfig({ ...config, totalHane: Number(e.target.value) })} fullWidth size="small" />
                    </Box>
                </Paper>
                <Paper sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: '12px', minHeight: 0 }}>
                    <Typography variant="subtitle1" sx={{ p: 2, pb: 1, fontWeight: 'bold', bgcolor: '#f5f5f5' }}>計測リスト</Typography>
                    <Divider />
                    <List dense sx={{ flexGrow: 1, overflowY: 'auto', maxHeight: isPortrait ? '200px' : 'none' }}>
                        {markers.map((m, i) => (
                            <ListItem key={i} divider secondaryAction={<IconButton edge="end" onClick={() => setMarkers(markers.filter((_, idx) => idx !== i))}><DeleteIcon /></IconButton>}>
                                <ListItemText primary={`${i + 1}. ${m.yuki} 往 / ${m.hane} 羽`} />
                            </ListItem>
                        ))}
                        <div ref={listEndRef} />
                    </List>
                </Paper>
                <Button fullWidth variant="outlined" onClick={() => setStep(1)} sx={{ mt: 'auto' }}>四隅を調整し直す</Button>
            </Box>
        </Box>
    );
}
