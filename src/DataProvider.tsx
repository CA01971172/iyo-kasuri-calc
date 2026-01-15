// src/contexts/KasuriContext.tsx
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

// 基本的な座標の型
export type Point = { x: number; y: number; };

// キャリブレーションの型
export type Calibration = {
    line0: { start: Point; end: Point; };
    lineMax: { start: Point; end: Point; };
};

// 設定データの型
export type KasuriConfig = {
    mmPerYuki: number;
};

// Contextが保持する全データの型
type KasuriContextType = {
    step: number;
    setStep: (step: number) => void;
    image: string | null;
    setImage: (image: string | null) => void;
    calibration: Calibration;
    setCalibration: (calibration: Calibration) => void;
    points: Point[];
    setPoints: (points: Point[]) => void;
    config: KasuriConfig;
    setConfig: (config: KasuriConfig) => void;
}

const DataContext = createContext<KasuriContextType>({} as KasuriContextType);

export function KasuriProvider({ children }: { children: ReactNode }) {
    const [step, setStep] = useState(0);
    const [image, setImage] = useState<string | null>(null);
    const [points, setPoints] = useState<Point[]>([]);
    
    // キャリブレーションの初期値（画像が表示された時に中央付近に出るようにするとUXが良い）
    const [calibration, setCalibration] = useState<Calibration>({
        line0: { start: { x: 100, y: 100 }, end: { x: 300, y: 100 } },
        lineMax: { start: { x: 100, y: 300 }, end: { x: 300, y: 300 } },
    });

    const [config, setConfig] = useState<KasuriConfig>({ 
        mmPerYuki: 1500 // 1往あたりの長さ
    });

    const value: KasuriContextType = {
        image,
        setImage,
        calibration,
        setCalibration,
        points,
        setPoints,
        config,
        setConfig,
        step,
        setStep,
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
}

// 使うためのカスタムフック
export const useKasuriContext = () => useContext(DataContext);
