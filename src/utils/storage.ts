/**
 * 計測データをブラウザの localStorage に保存する
 */
export const saveProjectToLocal = (data: any) => {
  try {
    const serializedData = JSON.stringify(data);
    localStorage.setItem('kasuri_project_data', serializedData);
  } catch (err) {
    console.error("LocalStorage save error:", err);
  }
};

/**
 * localStorage からデータを読み込む
 */
export const loadProjectFromLocal = () => {
  try {
    const saved = localStorage.getItem('kasuri_project_data');
    return saved ? JSON.parse(saved) : null;
  } catch (err) {
    console.error("LocalStorage load error:", err);
    return null;
  }
};

/**
 * データを JSON ファイルとしてダウンロードする
 * お祖母様がバックアップを取りたい時や、別の端末に移したい時に便利です
 */
export const exportToJsonFile = (data: any, fileName: string = 'kasuri_measure.json') => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};
