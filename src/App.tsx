import './App.css'
import { Box } from '@mui/material'
import { AppStepper } from './components/AppStepper'
import PhotoUploader from './PhotoUploader'

export default function App() {
    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100vw',
            overflow: 'hidden' // 画面全体のスクロールを防ぐ
        }}>
            {/* 上部：ステッパーエリア（線付き） */}
            <Box sx={{
                flexShrink: 0,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper'
            }}>
                <AppStepper />
            </Box>

            {/* 下部：メインコンテンツ */}
            <Box sx={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: '#fafafa', // 少し色を変えて境界を分かりやすく
                overflow: 'auto'    // 中身が溢れたらここだけスクロール
            }}>
                <PhotoUploader />
            </Box>
        </Box>
    )
}
