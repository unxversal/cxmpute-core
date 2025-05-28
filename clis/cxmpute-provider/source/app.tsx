import React, {useState, useEffect, useCallback} from 'react';
import {Box, Text, useApp} from 'ink';
import Spinner from 'ink-spinner';

import Splash from './components/Splash.js';
// import Setup from './components/Setup.js'; // Will create this in the next step
import Dashboard from './components/Dashboard.js';

import {
	initLocalStorage,
	getUserSession,
	setUserSession,
	getDiagnosticsData,
    getDashboardStats,
} from './lib/localStorage.js';
import {runDiagnosticsScript} from './scripts/runDiagnostics.js';
import {startNode, stopNode, fetchDashboardData} from './scripts/manageNode.js';
import type {
	DeviceDiagnostics,
	UserSessionData,
	DashboardStats,
} from './lib/interfaces.js';

// Placeholder Setup component
const Setup = ({
	onSetupComplete,
}: {
	onSetupComplete: (data: UserSessionData) => void;
}) => {
	const [countdown, setCountdown] = useState(3);

	useEffect(() => {
		if (countdown === 0) {
			// Simulate form submission and API call
			const fakeUserData: UserSessionData = {
				providerId: 'prov_abc123xyz',
				deviceId: 'dev_456def789',
				username: 'CliUser',
				providerAk: 'ak_samplekeyforcli',
				location: {country: 'US', state: 'CA', city: 'CliCity'},
			};
			onSetupComplete(fakeUserData);
			return;
		}

		const timer = setTimeout(() => {
			setCountdown(prev => prev - 1);
		}, 1000);
		return () => clearTimeout(timer);
	}, [countdown, onSetupComplete]);

	return (
		<Box flexDirection="column" alignItems="center" padding={2}>
			<Text color="yellow">--- SETUP SCREEN ---</Text>
			<Text>
				Imagine a beautiful form here powered by 'ink-form'.
			</Text>
			<Text>
				Collecting Username, Provider ID, Provider Key, Device Name, Location...
			</Text>
            <Text>For now, automatically submitting in {countdown}s...</Text>
			<Text>
				<Spinner type="dots" /> Submitting registration...
			</Text>
		</Box>
	);
};


export default function App() {
	const [currentScreen, setCurrentScreen] = useState<
		'splash' | 'setup' | 'dashboard'
	>('splash');
	const [isLoading, setIsLoading] = useState(true);
	const [loadingMessage, setLoadingMessage] = useState('Initializing...');
	const [error, setError] = useState<string | null>(null);

	const [diagnostics, setDiagnostics] = useState<DeviceDiagnostics | null>(null);
	const [userSession, setUserSessionState] = useState<UserSessionData | null>(null);
	const [dashboardStats, setDashboardStatsState] = useState<DashboardStats | null>(
		null,
	);

	const [nodeStatus, setNodeStatus] = useState<
		'off' | 'starting' | 'on' | 'stopping' | 'error'
	>('off');
	const [nodeServiceUrl, setNodeServiceUrl] = useState<string | null>(null);

	const {exit} = useApp();

    const attemptStartNode = useCallback(async (session: UserSessionData, diags: DeviceDiagnostics) => {
        if (!session || !diags) {
            setError("Missing session or diagnostics for starting node.");
            setNodeStatus("error");
            return;
        }
        setNodeStatus("starting");
        setLoadingMessage("Starting Cxmpute Node...");
        try {
            const result = await startNode(session, diags);
            if (result.success && result.url) {
                setNodeServiceUrl(result.url);
                setNodeStatus("on");
                setLoadingMessage("Fetching dashboard data...");
                const stats = await fetchDashboardData(session.providerId);
                setDashboardStatsState(stats);
            } else {
                throw new Error(result.message || "Failed to start node.");
            }
        } catch (e: any) {
            setError(`Node start failed: ${e.message}`);
            setNodeStatus("error");
            console.error("Node start error:", e);
        } finally {
            setLoadingMessage('');
        }
    }, []);


	useEffect(() => {
		initLocalStorage(); // Ensure storage directory exists

		const initializeApp = async () => {
			try {
				setCurrentScreen('splash');
				setIsLoading(true);
                setLoadingMessage('Running diagnostics...');
				let diagData = getDiagnosticsData(); // Try to get cached diagnostics
				if (!diagData) {
					diagData = await runDiagnosticsScript(); // Run and cache if not found
				}
				setDiagnostics(diagData);

                setLoadingMessage('Checking user session...');
				const storedUserSession = getUserSession();
				setUserSessionState(storedUserSession); // May be null

                // Attempt to load cached dashboard stats
                const cachedStats = getDashboardStats();
                if (cachedStats) setDashboardStatsState(cachedStats);


				if (storedUserSession && diagData) {
                    await attemptStartNode(storedUserSession, diagData);
					setCurrentScreen('dashboard');
				} else {
					setCurrentScreen('setup');
				}
			} catch (e: any) {
				setError(e.message || 'Initialization failed.');
                setNodeStatus("error");
				console.error("Initialization error:", e);
			} finally {
				setIsLoading(false);
                setLoadingMessage('');
			}
		};

		initializeApp();
	}, [attemptStartNode]);

	const handleSetupComplete = useCallback(async (newSessionData: UserSessionData) => {
		setUserSession(newSessionData); // Persist to localStorage
		setUserSessionState(newSessionData);
		if (diagnostics) {
            await attemptStartNode(newSessionData, diagnostics);
        } else {
            setError("Diagnostics not available after setup.");
            setNodeStatus("error");
        }
		setCurrentScreen('dashboard');
	}, [diagnostics, attemptStartNode]);

	const handleAppExit = useCallback(async () => {
        if (nodeStatus === "on" || nodeStatus === "starting") {
            setLoadingMessage("Shutting down node...");
            setNodeStatus("stopping");
            try {
                await stopNode();
                // console.log("Node stopped successfully on exit.");
            } catch (e) {
                console.error("Error stopping node during exit:", e);
            }
        }
		exit();
	}, [exit, nodeStatus]);

	useEffect(() => {
		process.on('SIGINT', handleAppExit);
		process.on('SIGTERM', handleAppExit);
		return () => {
			process.removeListener('SIGINT', handleAppExit);
			process.removeListener('SIGTERM', handleAppExit);
		};
	}, [handleAppExit]);


	if (isLoading && currentScreen === 'splash') {
		return <Splash />; // Splash has its own loading text if needed
	}
    if (isLoading) { // General loading for transitions after splash
        return (
            <Box padding={1} alignItems="center" justifyContent="center">
                <Text><Spinner type="dots" /> {loadingMessage || 'Loading...'}</Text>
            </Box>
        );
    }

	if (error && currentScreen !== 'dashboard') { // Show global error if not on dashboard
		return <Text color="red">Critical Error: {error}</Text>;
	}

	return (
		<Box flexDirection="column" width="100%">
			{currentScreen === 'setup' && !userSession && (
				<Setup onSetupComplete={handleSetupComplete} />
			)}
			{currentScreen === 'dashboard' && userSession && (
				<Dashboard
                    // Props for Dashboard.tsx to consume
                    providerId={userSession.providerId}
                    nodeStatus={nodeStatus}
                    earningsToday={dashboardStats?.earningsToday ?? 0}
                    earningsTotal={dashboardStats?.earningsTotal ?? 0}
                    referralsCount={dashboardStats?.referralsCount ?? 0}
                    generalError={error} // Dashboard can display this if it wants
                    // deviceTier={diagnostics && diagnostics.compute.gpu ? determineVRAMTier(diagnostics.compute.gpu.memory) : "Unknown"}
                    // nodeServiceUrl={nodeServiceUrl} // If dashboard needs to show it
				/>
			)}
            {/* Display a general loading/status message at the bottom if any */}
            {loadingMessage && !isLoading && nodeStatus !== 'off' && (
                 <Box marginTop={1} justifyContent="center">
                    <Text><Spinner type="dots" /> {loadingMessage}</Text>
                 </Box>
            )}
		</Box>
	);
}