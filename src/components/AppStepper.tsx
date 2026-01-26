import { Stepper, Step, StepLabel, Box, Typography } from '@mui/material';
import { useKasuriContext } from '../contexts/KasuriProvider';

const steps = ['写真を撮る', '基準線を合わせる', '図面を測る'];

export const AppStepper = () => {
    const { step } = useKasuriContext();

    return (
        <Box sx={{ width: '100%', pt: 4, pb: 2, bgcolor: 'background.paper' }}>
            <Stepper activeStep={step} sx={{ px: 2 }}>
                {steps.map((label, index) => (
                    <Step key={index}>
                        <StepLabel
                            slotProps={{
                                stepIcon: {
                                    sx: { transform: 'scale(1.3)' }
                                }
                            }}
                        >
                            <Typography 
                                sx={{ 
                                    fontSize: '1.1rem', 
                                    fontWeight: step === index ? 'bold' : 'normal',
                                    color: step === index ? 'primary.main' : 'text.secondary'
                                }}
                            >
                                {label}
                            </Typography>
                        </StepLabel>
                    </Step>
                ))}
            </Stepper>
        </Box>
    );
};
