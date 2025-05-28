// source/components/Splash.tsx
import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner';
import { generateFigletText } from '../lib/utils.js'; // Assuming utils.ts is in lib

const colors = ['#f8cb46', '#d64989', '#f76707']; // Yellow, Pink, Orange

export default function Splash() {
    const [figletArt, setFigletArt] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentColor, setCurrentColor] = useState(colors[0]);

    useEffect(() => {
        let isMounted = true;

        setCurrentColor(colors[Math.floor(Math.random() * colors.length)]);

        generateFigletText('cxmpute.cloud\nprovider')
            .then(text => {
                if (isMounted) {
                    setFigletArt(text);
                }
            })
            .catch(err => {
                if (isMounted) {
                    console.error("Splash: Figlet error:", err);
                    setError("Art generation failed."); // Keep it simple for splash
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    if (error) {
        // Fallback if figlet fails, still show a loading message
        return (
            <Box padding={2} flexDirection="column" alignItems="center" justifyContent="center">
                <Text color="red" bold>Cxmpute.Cloud Provider</Text>
                <Text><Spinner type="dots" /> Loading...</Text>
            </Box>
        );
    }

    if (!figletArt) {
        // While figlet is loading
        return (
            <Box padding={2} alignItems="center" justifyContent="center">
                <Text><Spinner type="dots" /> Initializing...</Text>
            </Box>
        );
    }

    return (
        <Box
            flexDirection="column"
            padding={2}
            alignItems="flex-start" // Center content horizontally
            justifyContent="center" // Center content vertically
            width="100%"
            height="100%" // Try to take full available space
        >
            <Box marginBottom={1}>
                <Text color={currentColor}>{figletArt}</Text>
            </Box>
            <Box>
                <Text>
                    <Text color="cyan"><Spinner type="dots" /></Text>
                    {' Running initial diagnostics...'}
                </Text>
            </Box>
        </Box>
    );
}