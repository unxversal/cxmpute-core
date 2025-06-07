// source/app.tsx
import React, {useState, useEffect, useCallback} from 'react';
import {Box, Text, useApp, Newline} from 'ink';
import Spinner from 'ink-spinner';
import { v4 as uuidv4 } from 'uuid'; // For generating provisionId before registration if needed

import Splash from './components/Splash.js';
import Setup from './components/Setup.js'; // Import the actual Setup component
import Dashboard from './components/Dashboard.js';

import {
	initLocalStorage,
	getUserSession,
	setUserSession,
	getDiagnosticsData,
    getDashboardStats,
    setDashboardStats, // To cache fetched stats
} from './lib/localStorage.js';
import {runDiagnosticsScript, determineVRAMTierString} from './scripts/runDiagnostics.js';
import {startNode, stopNode} from './scripts/manageNode.js'; // fetchDashboardData removed from here
import {registerDevice, fetchEarnings} from './lib/api.js'; // Import API functions
import type {
	DeviceDiagnostics,
	UserSessionData,
	DashboardStats,
} from './lib/interfaces.js';


// Props for App component from cli.tsx (if any)
// type AppProps = { name?: string };

export default function App(/* { name = 'Stranger' }: AppProps */) {
	const [currentScreen, setCurrentScreen] = useState<
		'splash' | 'setup' | 'dashboard'
	>('splash');
	const [isLoading, setIsLoading] = useState(true);
	const [loadingMessage, setLoadingMessage] = useState('Initializing...');
	const [appError, setAppError] = useState<string | null>(null); // Renamed from 'error'

	const [diagnostics, setDiagnostics] = useState<DeviceDiagnostics | null>(null);
	const [userSession, setUserSessionState] = useState<UserSessionData | null>(null);
	const [dashboardStats, setDashboardStatsState] = useState<DashboardStats | null>(null);

	const [nodeStatus, setNodeStatus] = useState<
		'off' | 'starting' | 'on' | 'stopping' | 'error'
	>('off');

	const {exit} = useApp();

    const loadDashboardData = useCallback(async (session: UserSessionData) => {
        if (!session?.providerId || !session?.providerAk) {
            setAppError("Cannot fetch dashboard data: Missing provider ID or API Key.");
            return;
        }
        setIsLoading(true);
        setLoadingMessage("Fetching dashboard data...");
        try {
            const stats = await fetchEarnings(session.providerId);
            setDashboardStatsState(stats);
            setDashboardStats(stats); // Cache it
        } catch (e: any) {
            setAppError(`Failed to load dashboard data: ${e.message}`);
            // Set to default stats on error
            const defaultStats = { earningsToday: 0, earningsTotal: 0, referralsCount: 0 };
            setDashboardStatsState(defaultStats);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, []); // Remove dashboardStats dependency to prevent infinite loop


    const attemptStartNodeAndLoadData = useCallback(async (session: UserSessionData, diags: DeviceDiagnostics) => {
        if (!session || !diags) {
            setAppError("Missing session or diagnostics for starting node.");
            setNodeStatus("error");
            return;
        }
        setNodeStatus("starting");
        setLoadingMessage("Starting Cxmpute Node...");
        try {
            const result = await startNode(session, diags, (statusMsg) => setLoadingMessage(`Node: ${statusMsg}`));
            if (result.success && result.url) {
                // setNodeServiceUrl(result.url);
                setNodeStatus("on");
                await loadDashboardData(session); // Fetch fresh data after node start
            } else {
                throw new Error(result.message || "Failed to start node.");
            }
        } catch (e: any) {
            setAppError(`Node start failed: ${e.message}`);
            setNodeStatus("error");
        } finally {
            // setLoadingMessage(''); // loadDashboardData will clear it or set its own
        }
    }, [loadDashboardData]); // Added loadDashboardData


	useEffect(() => {
		initLocalStorage();

		const initializeApp = async () => {
			try {
				setCurrentScreen('splash');
				setIsLoading(true);
                setLoadingMessage('Running diagnostics...');
				let diagData = getDiagnosticsData();
				if (!diagData) {
					diagData = await runDiagnosticsScript();
				}
				setDiagnostics(diagData);

                setLoadingMessage('Checking user session...');
				const storedUserSession = getUserSession();
				setUserSessionState(storedUserSession);

                const cachedStats = getDashboardStats();
                if (cachedStats) setDashboardStatsState(cachedStats);

				if (storedUserSession && diagData) {
                    await attemptStartNodeAndLoadData(storedUserSession, diagData);
					setCurrentScreen('dashboard');
				} else {
                    if (!diagData) { // Critical: diagnostics must run
                        setAppError("Failed to run device diagnostics. Cannot proceed.");
                        setIsLoading(false);
                        return;
                    }
					setCurrentScreen('setup');
				}
			} catch (e: any) {
				setAppError(e.message || 'Initialization failed.');
                setNodeStatus("error"); // Reflect error in node status
			} finally {
				setIsLoading(false);
                if (currentScreen !== 'dashboard') setLoadingMessage('');
			}
		};
		initializeApp();
	}, []); // Remove attemptStartNodeAndLoadData dependency to prevent infinite loop

	const handleSetupComplete = useCallback(async (setupData: Omit<UserSessionData, 'deviceId'> & { deviceName: string }) => {
        if (!diagnostics) {
            setAppError("Diagnostics not available. Cannot complete setup.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setLoadingMessage("Registering device with Cxmpute Cloud...");

        try {
            const registrationPayload = {
                deviceDiagnostics: diagnostics,
                providerId: setupData.providerId,
                providerAk: setupData.providerAk,
                location: setupData.location,
                username: setupData.username,
                deviceName: setupData.deviceName,
				provisionId: uuidv4().replace(/-/g, ''),
                // provisionId can be generated here or by the backend.
                // If generated here, ensure it's unique (e.g., uuidv4())
                // For now, assuming backend assigns it or we don't need to send it explicitly for 'new'
            };

            const regResponse = await registerDevice(registrationPayload);

            if (regResponse.success && regResponse.deviceId) {
                const newSessionData: UserSessionData = {
                    ...setupData,
                    deviceId: regResponse.deviceId, // Use deviceId from backend
                };
                setUserSession(newSessionData);
                setUserSessionState(newSessionData);
                await attemptStartNodeAndLoadData(newSessionData, diagnostics);
                setCurrentScreen('dashboard');
            } else {
                throw new Error(regResponse.message || "Device registration failed.");
            }
        } catch (e: any) {
            setAppError(`Setup failed: ${e.message}`);
            // Potentially revert to setup screen or show error prominently
            setCurrentScreen('setup'); // Stay on setup or go to an error screen
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
	}, [diagnostics, attemptStartNodeAndLoadData]);

	const handleAppExit = useCallback(async () => {
        if (nodeStatus === "on" || nodeStatus === "starting") {
            setNodeStatus("stopping"); // Update state if component is still mounted
            try {
                await stopNode(userSession); // Pass session if stopNode needs providerAk/deviceId
            } catch (e) {
                // Error stopping node during exit
            }
        }
		exit();
	}, [exit, nodeStatus, userSession]);

	useEffect(() => {
		process.on('SIGINT', handleAppExit);
		process.on('SIGTERM', handleAppExit);
		return () => {
			process.removeListener('SIGINT', handleAppExit);
			process.removeListener('SIGTERM', handleAppExit);
		};
	}, [handleAppExit]);

	if (currentScreen === 'splash' || (isLoading && !userSession && currentScreen !== 'setup')) {
		return <Splash />;
	}

    // If there's a critical app error preventing further operation (e.g., diagnostics failed)
    if (appError && currentScreen !== 'dashboard' && !isLoading) {
         return (
            <Box flexDirection="column" padding={1} alignItems="flex-start">
                <Text color="red" bold>CRITICAL ERROR:</Text>
                <Text color="red">{appError}</Text>
                <Newline/>
                <Text>Please resolve the issue and restart the application.</Text>
                <Text>Press Ctrl+C to exit.</Text>
            </Box>
        );
    }

	return (
		<Box padding={1}>
			{currentScreen === 'setup' && !userSession && diagnostics && (
				<Setup onSetupComplete={handleSetupComplete} />
			)}
			{currentScreen === 'dashboard' && userSession && diagnostics && (
				<Dashboard
                    providerId={userSession.providerId}
                    nodeStatus={nodeStatus}
                    earningsToday={dashboardStats?.earningsToday ?? 0}
                    earningsTotal={dashboardStats?.earningsTotal ?? 0}
                    referralsCount={dashboardStats?.referralsCount ?? 0}
                    deviceTier={determineVRAMTierString(diagnostics.compute.memory.free)}
                    // notifications={[]} // Add actual notifications if you have them
                    generalError={appError}
                    isLoading={isLoading && nodeStatus !== 'on'} // Show dashboard loading if node isn't fully 'on' yet or data is fetching
                    loadingMessage={loadingMessage}
				/>
			)}
            {/* Fallback loading/error display if not covered by screens */}
            {isLoading && (currentScreen as 'splash' | 'setup' | 'dashboard') !== 'splash' && (!userSession || currentScreen === 'dashboard') && (
                 <Box marginTop={1} justifyContent="center">
                    <Text><Spinner type="dots" /> {loadingMessage || 'Loading...'}</Text>
                 </Box>
            )}
		</Box>
	);
}