// source/components/Setup.tsx
import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {Box, Text, Newline } from 'ink'; // Removed useApp for now
import {Form, type FormProps, type FormField} from 'ink-form'; // Corrected FormFieldType to FormField
import Spinner from 'ink-spinner';
import {Country, State, City} from 'country-state-city'; // Kept for library return types
import type {UserSessionData} from '../lib/interfaces.js';
import {checkOllama} from '../lib/utils.js';

interface SetupProps {
	// diagnostics prop removed as it's not directly used in this form's logic
	onSetupComplete: (data: UserSessionData) => void;
}

type SetupStep = 'basicInfo' | 'country' | 'state' | 'city' | 'ollamaConfirm' | 'submitting';

// Helper to create select options for ink-form
const toFormSelectOptions = (items: Array<{ label: string; value: any }>) => {
    return items.map(item => ({ label: item.label, value: item.value }));
};

// Internal state for collecting form data step-by-step
interface InternalFormData {
    username?: string;
    providerId?: string;
    providerAk?: string;
    deviceName?: string;
    countryIso?: string;
    countryName?: string;
    stateIso?: string;
    stateName?: string;
    cityName?: string;
}

export default function Setup({onSetupComplete}: SetupProps) {
	const [currentStep, setCurrentStep] = useState<SetupStep>('basicInfo');
	const [formData, setFormData] = useState<InternalFormData>({});

	const [countryOptions, setCountryOptions] = useState(toFormSelectOptions([]));
	const [stateOptions, setStateOptions] = useState(toFormSelectOptions([]));
	const [cityOptions, setCityOptions] = useState(toFormSelectOptions([]));

    const [ollamaChecked, setOllamaChecked] = useState(false);
    const [ollamaStatus, setOllamaStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
    const [ollamaMessage, setOllamaMessage] = useState("");

	const [isProcessing, setIsProcessing] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	useEffect(() => {
		const allCountries = Country.getAllCountries().map(c => ({
			label: `${c.flag || ''} ${c.name}`,
			value: c.isoCode,
		}));
		setCountryOptions(toFormSelectOptions(allCountries));
	}, []);

    const handleOllamaCheckAndProceed = useCallback(async (confirmInstall: boolean) => {
        setOllamaChecked(confirmInstall);
        if (confirmInstall) {
            setIsProcessing(true);
            setOllamaStatus("checking");
            setOllamaMessage("Verifying Ollama installation...");
            const result = await checkOllama();
            if (result.ok) {
                setOllamaStatus("ok");
                setOllamaMessage(`Ollama detected (Version: ${result.version || 'N/A'}).`);
            } else {
                setOllamaStatus("error");
                setOllamaMessage(result.error || "Ollama not found or not running. You can proceed, but some services may be unavailable.");
            }
            setIsProcessing(false);
        } else {
            setOllamaStatus("idle");
            setOllamaMessage("Ollama not checked. LLM services will be unavailable.");
        }
        setCurrentStep('submitting');
    }, []);

	useEffect(() => {
        if (currentStep === 'submitting') {
            const finalSubmit = async () => {
                setIsProcessing(true);
                setSubmitError(null);

                if (!formData.username || !formData.providerId || !formData.providerAk || !formData.deviceName || !formData.countryName || !formData.stateName || !formData.cityName) {
                    setSubmitError("Critical error: Not all form data is available for submission. Please restart setup.");
                    setIsProcessing(false);
                    setCurrentStep('basicInfo'); // Revert to a safe step
                    return;
                }

                const completeSessionData: UserSessionData = {
                    username: formData.username,
                    providerId: formData.providerId,
                    providerAk: formData.providerAk,
                    deviceId: 'to-be-assigned-by-backend',
                    location: {
                        country: formData.countryName,
                        state: formData.stateName,
                        city: formData.cityName,
                    },
                    deviceName: formData.deviceName,
                    // installedSoftware: { ollama: ollamaChecked && ollamaStatus === 'ok' } // Example
                };

                try {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API
                    onSetupComplete(completeSessionData);
                } catch (e: any) {
                    setSubmitError(e.message || "Final registration failed.");
                } finally {
                    setIsProcessing(false);
                }
            };
            finalSubmit();
        }
	}, [currentStep, formData, onSetupComplete, ollamaChecked, ollamaStatus]);


	const formProps: FormProps = useMemo(() => {
		let title = '';
		let fields: FormField[] = []; // Changed FormFieldType to FormField
        let sectionTitle = ''; // Each section needs a title, can be empty

		switch (currentStep) {
			case 'basicInfo':
				title = 'Account & Device Information';
                sectionTitle = 'Step 1: Basic Details';
				fields = [
					{type: 'string', name: 'username', label: 'Username (your display name)', initialValue: formData.username || ''},
					{type: 'string', name: 'providerId', label: 'Provider ID', initialValue: formData.providerId || ''},
                    {type: 'string', name: 'providerAk', label: 'Provider API Key', mask:'*', initialValue: formData.providerAk || ''},
					{type: 'string', name: 'deviceName', label: 'Device Name (nickname for this machine)', initialValue: formData.deviceName || ''},
				];
				break;
			case 'country':
				title = 'Select Your Location';
                sectionTitle = 'Step 2: Country';
				fields = [
                    {type: 'select', name: 'countryIso', label: 'Country', options: countryOptions}
                ];
				break;
			case 'state':
				title = 'Select Your Location';
                sectionTitle = 'Step 3: State/Province';
                fields = [
                    {type: 'select', name: 'stateIso', label: 'State/Province', options: stateOptions}
                ];
				break;
			case 'city':
				title = 'Select Your Location';
                sectionTitle = 'Step 4: City';
                fields = [
                    {type: 'select', name: 'cityName', label: 'City', options: cityOptions}
                ];
				break;
            case 'ollamaConfirm':
                title = 'Optional Software Check';
                sectionTitle = 'Step 5: Ollama (Recommended)';
                fields = [
                    {
                        type: 'boolean',
                        name: 'confirmOllama',
                        label: 'Is Ollama installed and running on your system?',
                        initialValue: ollamaChecked,
                    }
                ];
                break;
		}
		return {
			form: {
				title,
				sections: [{ title: sectionTitle, fields}], // Ensure section has a title
			},
            onSubmit: (values: any) => {
                setSubmitError(null);
                if (currentStep === 'basicInfo') {
                    setFormData(prev => ({...prev, ...values}));
                    setCurrentStep('country');
                } else if (currentStep === 'country') {
                    const country = Country.getCountryByCode(values.countryIso);
                    if (country) {
                        setFormData(prev => ({...prev, countryIso: country.isoCode, countryName: country.name}));
                        const stateData = State.getStatesOfCountry(country.isoCode).map(s => ({label: s.name, value: s.isoCode}));
                        setStateOptions(toFormSelectOptions(stateData));
                        setCurrentStep('state');
                    } else {
                        setSubmitError("Invalid country selected.");
                    }
                } else if (currentStep === 'state') {
                    const countryIso = formData.countryIso;
                    const state = countryIso ? State.getStateByCodeAndCountry(values.stateIso, countryIso) : null;
                    if (state && countryIso) {
                        setFormData(prev => ({...prev, stateIso: state.isoCode, stateName: state.name }));
                        const cityData = City.getCitiesOfState(countryIso, state.isoCode).map(c => ({label: c.name, value: c.name}));
                        setCityOptions(toFormSelectOptions(cityData));
                        setCurrentStep('city');
                    } else {
                        setSubmitError("Invalid state selected or country context lost.");
                    }
                } else if (currentStep === 'city') {
                    setFormData(prev => ({...prev, cityName: values.cityName }));
                    setCurrentStep('ollamaConfirm');
                } else if (currentStep === 'ollamaConfirm') {
                    handleOllamaCheckAndProceed(values.confirmOllama);
                }
            }
		};
	}, [currentStep, formData, countryOptions, stateOptions, cityOptions, ollamaChecked, handleOllamaCheckAndProceed]);


	if (isProcessing || currentStep === 'submitting') {
        return (
            <Box padding={1} flexDirection="column" alignItems="flex-start">
                <Text><Spinner type="dots"/> {ollamaStatus === "checking" ? ollamaMessage : "Processing your registration..."}</Text>
                {submitError && <Text color="red">{submitError}</Text>}
            </Box>
        );
    }

	return (
		<Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan" width="100%">
			<Box justifyContent="center" marginBottom={1}>
				<Text bold color="yellow">
					Cxmpute Provider Setup
				</Text>
			</Box>
            <Text dimColor>Please follow the steps to register your device. Use arrow keys and Enter.</Text>
            <Newline/>

			<Form {...formProps} />
            <Newline/>
            {ollamaStatus !== 'idle' && ollamaStatus !== 'checking' && currentStep === 'ollamaConfirm' && (
                 <Box flexDirection="column" marginTop={1} borderStyle="single" paddingX={1} borderColor="gray">
                    <Text dimColor={ollamaStatus === 'error'}>{ollamaMessage}</Text>
                 </Box>
            )}
			{submitError && (
				<Box marginTop={1}>
					<Text color="red">Error: {submitError}</Text>
				</Box>
			)}
            <Newline/>
            <Text dimColor>Press ESC within a field to clear it, or during selection to go back (behavior depends on ink-form).</Text>
		</Box>
	);
}