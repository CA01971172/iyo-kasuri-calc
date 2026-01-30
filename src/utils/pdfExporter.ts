import { jsPDF } from 'jspdf';
import type { Marker } from '../contexts/KasuriProvider';

export const exportToPdf = async (
    imageSrc: string,
    markers: Marker[],
    config: { totalYuki: number; totalHane: number }
) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // 1. タイトルと情報の追加
    doc.setFontSize(18);
    doc.text('かすり計測結果報告書', 10, 20);
    doc.setFontSize(10);
    doc.text(`総往数: ${config.totalYuki} / 総羽数: ${config.totalHane}`, 10, 30);
    doc.text(`計測日: ${new Date().toLocaleDateString()}`, 10, 35);

    // 2. 画像の描画（仮想Canvasを使用してマーカーを合成）
    const img = new Image();
    img.src = imageSrc;
    await new Promise((resolve) => (img.onload = resolve));

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 元画像を描画
    ctx.drawImage(img, 0, 0);

    // 全てのマーカーを描画（画面サイズに関わらず、画像本来の解像度で打つ）
    markers.forEach((m, i) => {
        const x = m.x * img.width;
        const y = m.y * img.height;
        const r = img.width / 150; // 画像の大きさに合わせた適切な半径

        ctx.fillStyle = '#ffff00';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = r / 3;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 番号も入れると紙で見た時に分かりやすい
        ctx.fillStyle = '#000';
        ctx.font = `bold ${r * 2}px sans-serif`;
        ctx.fillText(`${i + 1}`, x + r, y - r);
    });

    // 合成した画像をPDFに貼り付け
    const combinedData = canvas.toDataURL('image/jpeg', 0.8);
    const imgProps = doc.getImageProperties(combinedData);
    const imgWidth = pageWidth - 20;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    doc.addImage(combinedData, 'JPEG', 10, 45, imgWidth, imgHeight);

    // 3. 計測リスト（表）の追加
    let currentY = 45 + imgHeight + 10;
    doc.text('【計測地点詳細】', 10, currentY);
    currentY += 7;
    
    markers.forEach((m, i) => {
        if (currentY > 280) { doc.addPage(); currentY = 20; }
        doc.text(`${i + 1}点目: ${m.yuki} 往 / ${m.hane} 羽`, 15, currentY);
        currentY += 6;
    });

    doc.save(`かすり計測結果_${new Date().getTime()}.pdf`);
};
