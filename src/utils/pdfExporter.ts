import { jsPDF } from 'jspdf';

// publicフォルダに置いたフォントファイルをBase64に変換して読み込む
const loadLocalFont = async (url: string) => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            // "data:font/ttf;base64,XXXX..." のXXXXの部分だけを抽出
            resolve(base64data.split(',')[1]);
        };
        reader.readAsDataURL(blob);
    });
};

export const exportToPdf = async (
    imageSrc: string,
    markers: { yuki: number; hane: number; x: number; y: number }[],
    config: { totalYuki: number; totalHane: number }
) => {
    const doc = new jsPDF('p', 'mm', 'a4');

    try {
        // 1. ローカル（public/fonts/）からフォントを読み込む
        const fontBase64 = await loadLocalFont('/fonts/NotoSansJP-Regular.ttf');
        
        // 2. jsPDFに登録
        doc.addFileToVFS('NotoSansJP.ttf', fontBase64);
        doc.addFont('NotoSansJP.ttf', 'NotoSansJP', 'normal');
        doc.setFont('NotoSansJP');
    } catch (e) {
        console.error("フォントの読み込みに失敗しました:", e);
        // 失敗した場合は標準フォント（英語のみ）で続行
    }

    // --- ここから描画処理（日本語が使えるようになります） ---

    doc.setFontSize(18);
    doc.text('かすり計測結果', 10, 20);

    doc.setFontSize(10);
    doc.text(`総往数: ${config.totalYuki} / 総羽数: ${config.totalHane}`, 10, 30);
    doc.text(`計測日: ${new Date().toLocaleDateString()}`, 10, 35);

    // 画像とマーカーの合成Canvas処理
    const img = new Image();
    img.src = imageSrc;
    await new Promise((resolve) => (img.onload = resolve));

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);

    // 点を少し小さめに（分母を250くらいに調整）
    const r = img.width / 250; 
    markers.forEach((m, _i) => {
        const x = m.x * img.width;
        const y = m.y * img.height;
        ctx.fillStyle = '#ffff00';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = r / 4;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });

    const combinedData = canvas.toDataURL('image/jpeg', 0.8);
    // 画像をA4の横幅いっぱいに収める計算
    const pdfImgWidth = 190;
    const pdfImgHeight = (img.height * pdfImgWidth) / img.width;
    doc.addImage(combinedData, 'JPEG', 10, 45, pdfImgWidth, pdfImgHeight);

    // 計測地点詳細（日本語）
    let currentY = 45 + pdfImgHeight + 15;
    doc.setFontSize(12);
    doc.text('【計測地点詳細】', 10, currentY);
    currentY += 8;

    doc.setFontSize(10);
    markers.forEach((m, i) => {
        if (currentY > 280) { doc.addPage(); currentY = 20; }
        doc.text(`${i + 1}点目: ${m.yuki} 往 / ${m.hane} 羽`, 15, currentY);
        currentY += 6;
    });

    doc.save(`かすり計測_${new Date().getTime()}.pdf`);
};
