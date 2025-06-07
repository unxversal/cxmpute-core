// source/components/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { Text, Box, Newline } from 'ink';
import Spinner from 'ink-spinner';
import { DOLPHIN_ANSI_FIVE, DOLPHIN_ANSI_SIX, generateFigletText } from '../lib/utils.js';
import Link from 'ink-link';

// Define colors at the top or import from a theme file if you have one
const figletColors = ['#f8cb46', '#d64989', '#f76707']; // Yellow, Pink, Orange
const DOLPHINS = [DOLPHIN_ANSI_FIVE, DOLPHIN_ANSI_SIX];

// Props definition for the Dashboard
interface DashboardProps {
    providerId: string; // This is also the referral code
    nodeStatus: 'off' | 'starting' | 'on' | 'stopping' | 'error';
    earningsToday: number;
    earningsTotal: number;
    referralsCount: number;
    deviceTier: string; // e.g., "Tide Pool (Tier 1 - 1-4GB VRAM)"
    notifications?: string[]; // Optional array of notification strings
    generalError?: string | null; // For displaying errors from App.tsx
    isLoading?: boolean; // To show loading state for data fetching
    loadingMessage?: string; // Message to show when isLoading is true
}

export default function Dashboard({
    providerId,
    nodeStatus,
    earningsToday,
    earningsTotal,
    referralsCount,
    deviceTier,
    notifications,
    generalError,
    isLoading = false, // Default to false
    loadingMessage = 'Loading dashboard data...'
}: DashboardProps) {
    const [figletArt, setFigletArt] = useState<string | null>(null);
    const [figletError, setFigletError] = useState<string | null>(null);
    const [currentFigletColor, setCurrentFigletColor] = useState(figletColors[0]);
    const [currentDolphin, setCurrentDolphin] = useState(DOLPHINS[0]);

    useEffect(() => {
        let isMounted = true;
        setCurrentFigletColor(figletColors[Math.floor(Math.random() * figletColors.length)]);
        setCurrentDolphin(DOLPHINS[Math.floor(Math.random() * DOLPHINS.length)]);

        generateFigletText('cxmpute.cloud\nprovider')
            .then(text => {
                if (isMounted) setFigletArt(text);
            })
            .catch(err => {
                if (isMounted) {
                    console.error("Dashboard: Failed to generate figlet text:", err);
                    setFigletError("Could not load hero text.");
                }
            });
        return () => { isMounted = false; };
    }, []);

    const statusTextMap = {
        on: "ACTIVE",
        off: "INACTIVE",
        starting: "STARTING...",
        stopping: "STOPPING...",
        error: "ERROR",
    };

    const statusColorMap = {
        on: "#20a191", // cxmputeGreen
        off: "red",
        starting: "yellow",
        stopping: "yellow",
        error: "red",
    };

    const nodeStatusDisplay = statusTextMap[nodeStatus] || "UNKNOWN";
    const nodeStatusColor = statusColorMap[nodeStatus] || "gray";


    if (figletError && !figletArt) { // If figlet fails but we still need to render dashboard
        // Render a simplified header or just proceed without figlet
    }

    if (isLoading && !figletArt) { // Initial heavy loading, show minimal
        return (
            <Box padding={1} alignItems="center" justifyContent="center" width="100%">
                <Text><Spinner type="dots" /> {loadingMessage}</Text>
            </Box>
        );
    }


    return (
        <Box flexDirection="column" padding={1} width="100%">
            {generalError && (
                <Box borderStyle="single" borderColor="red" paddingX={1} marginBottom={1} alignItems="flex-start">
                    <Text color="red" bold>System Error: </Text>
                    <Text color="red">{generalError}</Text>
                </Box>
            )}

            {figletArt ? (
                <Text color={currentFigletColor}>{figletArt}</Text>
            ) : figletError ? (
                <Box justifyContent="center" marginBottom={1}><Text color="red">{figletError}</Text></Box>
            ) : (
                <Box justifyContent="center" marginBottom={1}><Text><Spinner type="dots" /> Loading Art...</Text></Box>
            )}

            <Box flexDirection="row" marginTop={figletArt ? 0 : 1}>
                <Box marginRight={2}>
                    <Text color={currentFigletColor}>{currentDolphin}</Text>
                </Box>

                <Box flexDirection="column" justifyContent="flex-start" >
                    {/* Provider ID / Referral Code */}
                    <Box borderStyle="round" borderColor={currentFigletColor} paddingX={1} marginBottom={1} alignItems="flex-start">
                        <Text bold>PROVIDER/REFERRAL ID: </Text>
                        <Text>{providerId}</Text>
                    </Box>

                    {/* Node Status */}
                    <Box borderStyle="round" borderColor={nodeStatusColor} paddingX={1} paddingY={0} marginBottom={1} alignItems="center">
                        <Text bold color={nodeStatusColor}>
                            {nodeStatus === 'starting' || nodeStatus === 'stopping' || isLoading ? <Spinner type="dots" /> : '〇 '}
                            STATUS: {nodeStatusDisplay}
                        </Text>
                    </Box>

                    {/* Earnings */}
                    <Box flexDirection="row" marginBottom={1}>
                        <Box borderStyle="round" borderColor={currentFigletColor} paddingX={1} marginRight={1} flexGrow={1} alignItems="flex-start">
                            <Text bold>TODAY'S EARNINGS: </Text>
                            <Text>{isLoading ? '...' : earningsToday.toFixed(2)}</Text>
                        </Box>
                        <Box borderStyle="round" borderColor={currentFigletColor} paddingX={1} flexGrow={1} alignItems="flex-start">
                            <Text bold>ALL TIME EARNINGS: </Text>
                            <Text>{isLoading ? '...' : earningsTotal.toFixed(2)}</Text>
                        </Box>
                    </Box>

                    {/* Referrals */}
                    <Box borderStyle="round" borderColor={currentFigletColor} paddingX={1} marginBottom={1} flexDirection="row" justifyContent="space-between" alignItems="center">
                        <Box alignItems="flex-start">
                            <Text bold>REFERRALS: </Text>
                            <Text>{isLoading ? '...' : referralsCount}</Text>
                        </Box>
                        <Link url="https://cxmpute.cloud/referrals">
                            <Text color={currentFigletColor} bold> LEARN MORE</Text>
                        </Link>
                    </Box>

                    {/* Device Tier */}
                    <Box borderStyle="round" borderColor="gray" paddingX={1} marginBottom={1} alignItems="flex-start">
                        <Text bold>DEVICE TIER: </Text>
                        <Text>{deviceTier}</Text>
                    </Box>

                </Box>
            </Box>
            {/* Notifications Area */}
            {notifications && notifications.length > 0 && (
                <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="yellow" padding={1} alignItems="flex-start">
                    <Text bold color="yellow">NOTIFICATIONS:</Text>
                    {notifications.map((note, index) => (
                        <Text key={index}>- {note}</Text>
                    ))}
                </Box>
            )}
             {isLoading && figletArt && ( // Show loading indicator if fetching data after art is loaded
                <Box marginTop={1} justifyContent="center">
                    <Text><Spinner type="dots"/> {loadingMessage}</Text>
                </Box>
            )}
            <Newline />
            <Text dimColor>Press Ctrl+C to stop the node and exit.</Text>
        </Box>
    );
}