// src/contexts/KasuriContext.tsx
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useMediaQuery } from '@mui/material';
import type { Point } from '../utils/homography';

// キャリブレーションの型
export type Calibration = {
    line0: { start: Point; end: Point; };
    lineMax: { start: Point; end: Point; };
};

// 設定データの型
export type KasuriConfig = {
    totalYuki: number;    // 総行数
    totalHane: number;    // 総羽数
};

// マーカーの型
export type Marker = {
    yuki: number,
    hane: number,
    x: number,
    y: number,
    ratioX: number, // 画像幅に対する比率 (0.0 〜 1.0)
    ratioY: number, // 画像高さに対する比率 (0.0 〜 1.0)
};

// Contextが保持する全データの型
type KasuriContextType = {
    step: number;
    setStep: (step: number) => void;
    image: string | null;
    setImage: (image: string | null) => void;
    points: Point[];
    setPoints: (points: Point[]) => void;
    config: KasuriConfig;
    setConfig: React.Dispatch<React.SetStateAction<KasuriConfig>>
    isPortrait: boolean;
    markers: Marker[];
    setMarkers: React.Dispatch<React.SetStateAction<Marker[]>>;
}

const DataContext = createContext<KasuriContextType>({} as KasuriContextType);

export function KasuriProvider({ children }: { children: ReactNode }) {
    const [step, setStep] = useState(0);
    const [image, setImage] = useState<string | null>(null);
    const [points, setPoints] = useState<Point[]>([
        { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 },
        { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }
    ]);
    const isPortrait = useMediaQuery('(orientation: portrait)');
    const [markers, setMarkers] = useState<Marker[]>([]);
    const [config, setConfig] = useState<KasuriConfig>({
        totalYuki: 32,       // 32行
        totalHane: 80,       // 80羽（図面の横幅が80ユニット分）
    });

    const value: KasuriContextType = {
        image,
        setImage,
        points,
        setPoints,
        config,
        setConfig,
        step,
        setStep,
        isPortrait,
        markers,
        setMarkers,
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
}

// 使うためのカスタムフック
export const useKasuriContext = () => useContext(DataContext);
