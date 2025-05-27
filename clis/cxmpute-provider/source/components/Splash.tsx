// source/components/Splash.tsx
import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner'; // Import the Spinner component
import { generateFigletText } from '../lib/utils.js';

const colors = ['#f8cb46' , '#d64989', '#f76707']

export default function Splash() {
    const [figletArt, setFigletArt] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentColor, setCurrentColor] = useState(colors[0]); // State for figlet color

    useEffect(() => {
        let isMounted = true;

        // Set an initial random color for figlet art
        setCurrentColor(colors[Math.floor(Math.random() * colors.length)]);

        generateFigletText('cxmpute.cloud\nprovider')
            .then(text => {
                if (isMounted) {
                    setFigletArt(text);
                }
            })
            .catch(err => {
                if (isMounted) {
                    console.error("Failed to generate figlet text:", err);
                    setError("Could not load art.");
                }
            });

        return () => {
            isMounted = false; // Cleanup function
        };
    }, []); // Empty dependency array means this runs once on mount

    if (error) {
        return (
            <Box padding={1} alignItems="center" justifyContent="center" width="100%" height="100%">
                <Text color="red">{error}</Text>
            </Box>
        );
    }

    if (!figletArt) {
        // Initial loading state for the whole splash screen before figlet art is ready
        return (
            <Box padding={1} alignItems="center" justifyContent="center" width="100%" height="100%">
                <Text>
                    <Spinner type="dots" />
                    {' Initializing...'}
                </Text>
            </Box>
        );
    }

    return (
        <Box 
            flexDirection="column" 
            padding={2} // Increased padding for better centering
            width="100%" 
            height="100%" // Make it take full height
        >
            {/* Figlet Art */}
            <Box marginBottom={2}> 
                <Text color={currentColor}>{figletArt}</Text>
            </Box>

            {/* Loading Text with Spinner */}
            <Box>
                <Text>
                    <Text color="cyan"> {/* Optional: color the spinner */}
                        <Spinner type="dots" /> 
                    </Text>
                    {' Loading Cxmpute Provider...'}
                </Text>
            </Box>
        </Box>
    );
}