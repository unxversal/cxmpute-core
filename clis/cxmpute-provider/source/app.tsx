import React, { useState } from 'react';
import {Box, Text} from 'ink';
import Splash from './components/Splash.js';
import Dashboard from './components/Dashboard.js';

type Props = {
	name: string | undefined;
};

export default function App({name = 'Stranger'}: Props) {

	const [screen] = useState('dashboard');

	return (
		<Box>
			{screen === 'splash' && (
				<Splash />
			)}
			{screen === 'dashboard' && (
				<Dashboard />
			)}
			{screen === 'main' && <Text color="green">Hello, {name}</Text>}
		</Box>
	);
}
