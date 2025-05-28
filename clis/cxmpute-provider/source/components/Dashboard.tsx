// source/components/Dashboard.tsx
// contains:
// hero: CXMPUTE.CLOUD PROVIDER
// Total Earnings past day
// Total Earnings all time
// Num Referrals
// Referrals Code
// Node status (on/off)
// Device Tier
// Tide Pool (up to 4 GB)
// Blue Surf (4-8GB)
// Open Ocean (8-22GB)
// Mariana Depth (22GB+)
// notifications (if any)

import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner'; // Import the Spinner component
import { DOLPHIN_ANSI_FIVE, DOLPHIN_ANSI_SIX, generateFigletText } from '../lib/utils.js';
import Link from 'ink-link';

const colors = ['#f8cb46' , '#d64989', '#f76707']
const DOLPHINS = [ DOLPHIN_ANSI_FIVE, DOLPHIN_ANSI_SIX ];
const cxmputeGreen = "#20a191"

export default function Dashboard() {
    const [figletArt, setFigletArt] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentColor, setCurrentColor] = useState(colors[0]); // State for figlet color
    const [currentDolphin, setCurrentDolphin] = useState(DOLPHINS[0]); // State for dolphin art

    useEffect(() => {
        let isMounted = true;

        // Set an initial random color for figlet art
        setCurrentColor(colors[Math.floor(Math.random() * colors.length)]);
        // Set an initial random dolphin art
        setCurrentDolphin(DOLPHINS[Math.floor(Math.random() * DOLPHINS.length)]);

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

            
            
            <Text color={currentColor}>{figletArt}</Text>

            <Box flexDirection='row'>
                <Text color={currentColor}>
                    {currentDolphin}
                </Text>
                
                <Box flexDirection='column' justifyContent='center' marginLeft={1} marginRight={1}>
                    <Box borderStyle="bold" borderColor={currentColor} justifyContent="center"> 
                        <Text bold>
                            PROVIDER/REFERRAL ID: b2d74ec941cc42e499c1ac6026b0e224
                        </Text>
                    </Box>

                    <Box borderStyle={'bold'} borderColor={cxmputeGreen} padding={1} justifyContent="center">
                        <Text bold color={cxmputeGreen}>
                            〇 STATUS: ACTIVE
                        </Text>
                    </Box>
                    <Box flexDirection='row' justifyContent='space-between'>
                        <Box borderStyle={'bold'} borderColor={currentColor} paddingLeft={2} paddingRight={2}>
                            <Text bold>
                                TODAY'S EARNINGS: 12345
                            </Text>
                        </Box>
                        <Box borderStyle={'bold'} borderColor={currentColor} paddingLeft={2} paddingRight={2}>
                            <Text bold>
                                ALL TIME EARNINGS: 45678
                            </Text>
                        </Box>
                    </Box>
                    <Box flexDirection='row' justifyContent='space-between' padding={1} borderStyle={'bold'} borderColor={currentColor} gap={1}>
                        <Text bold>
                            REFERRALS: 10
                        </Text>
                        <Link url="https://cxmpute.cloud/referrals">
                             <Text color={currentColor} bold>LEARN MORE</Text>
                        </Link>
                    </Box>
                </Box>
                
            </Box>
            

            
            
        </Box>
    );
}