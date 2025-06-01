// source/components/Setup.tsx
import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {Box, Text, Newline, useInput, useFocusManager } from 'ink';
// Removed TextInput from 'ink-text-input'
import SelectInput from 'ink-select-input'; // Ensure this is ink-select-input v4+ for better focus handling
import {Form, type FormProps, type FormField} from 'ink-form';
import Spinner from 'ink-spinner';
import {Country, State, City} from 'country-state-city';
import type { ICountry, IState, ICity } from 'country-state-city';
import type {UserSessionData} from '../lib/interfaces.js';
import {checkOllama} from '../lib/utils.js';

interface SetupProps {
	onSetupComplete: (data: UserSessionData) => void;
}

type SetupStep = 
  | 'basicInfo' 
  | 'selectingCountry' 
  | 'selectingState' 
  | 'selectingCity' 
  | 'ollamaConfirm' 
  | 'submitting';

interface SelectOption { label: string; value: string; }

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

const MAX_DISPLAY_ITEMS = 7;

// Blinking cursor component
const BlinkingCursor = () => {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => setVisible(v => !v), 500);
    return () => clearInterval(interval);
  }, []);
  return visible ? <Text>█</Text> : <Text> </Text>;
};


export default function Setup({onSetupComplete}: SetupProps) {
    const [currentStep, setCurrentStep] = useState<SetupStep>('basicInfo');
    const [formData, setFormData] = useState<InternalFormData>({});
    
    const [filter, setFilter] = useState('');
    const [activeSelectionOptions, setActiveSelectionOptions] = useState<SelectOption[]>([]);
    
    const [allCountries, setAllCountries] = useState<ICountry[]>([]);
    const [statesOfSelectedCountry, setStatesOfSelectedCountry] = useState<IState[]>([]);
    const [citiesOfSelectedState, setCitiesOfSelectedState] = useState<ICity[]>([]);

    const [ollamaChecked, setOllamaChecked] = useState(false);
    const [ollamaStatus, setOllamaStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
    const [ollamaMessage, setOllamaMessage] = useState("");

    const [isProcessing, setIsProcessing] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Focus management for custom input
    const { focus } = useFocusManager();
    const isCustomInputFocused = 
        currentStep === 'selectingCountry' || 
        currentStep === 'selectingState' || 
        currentStep === 'selectingCity';

    useEffect(() => {
        if (isCustomInputFocused) {
            // Attempt to "focus" our custom input area when it becomes active
            // This is conceptual; Ink doesn't have explicit focus IDs for non-interactive elements.
            // The `useInput` hook's `isActive` prop will control its behavior.
            focus('customInput');
        }
    }, [isCustomInputFocused]);


    useEffect(() => {
        setAllCountries(Country.getAllCountries());
    }, []);

    useEffect(() => {
        let options: SelectOption[] = [];
        const lowerFilter = filter.toLowerCase().trim();

        if (currentStep === 'selectingCountry') {
            options = allCountries
                .filter(c => c.name.toLowerCase().includes(lowerFilter) || c.isoCode.toLowerCase().includes(lowerFilter))
                .map(c => ({ label: `${c.flag || ''} ${c.name} (${c.isoCode})`, value: c.isoCode }));
        } else if (currentStep === 'selectingState') {
            options = statesOfSelectedCountry
                .filter(s => s.name.toLowerCase().includes(lowerFilter) || s.isoCode.toLowerCase().includes(lowerFilter))
                .map(s => ({ label: `${s.name} (${s.isoCode})`, value: s.isoCode }));
        } else if (currentStep === 'selectingCity') {
            options = citiesOfSelectedState
                .filter(c => c.name.toLowerCase().includes(lowerFilter))
                .map(c => ({ label: c.name, value: c.name }));
        }
        setActiveSelectionOptions(options);
    }, [filter, currentStep, allCountries, statesOfSelectedCountry, citiesOfSelectedState]);

    const handleCountrySelect = (item: SelectOption) => {
        const selectedCountry = allCountries.find(c => c.isoCode === item.value);
        if (selectedCountry) {
            setFormData(prev => ({...prev, countryIso: selectedCountry.isoCode, countryName: selectedCountry.name}));
            setStatesOfSelectedCountry(State.getStatesOfCountry(selectedCountry.isoCode));
            setFilter('');
            setCurrentStep('selectingState');
        }
    };

    const handleStateSelect = (item: SelectOption) => {
        if (formData.countryIso) {
            const selectedState = State.getStateByCodeAndCountry(item.value, formData.countryIso);
            if (selectedState) {
                setFormData(prev => ({...prev, stateIso: selectedState.isoCode, stateName: selectedState.name }));
                setCitiesOfSelectedState(City.getCitiesOfState(formData.countryIso!, selectedState.isoCode));
                setFilter('');
                setCurrentStep('selectingCity');
            }
        }
    };

    const handleCitySelect = (item: SelectOption) => {
        setFormData(prev => ({...prev, cityName: item.value}));
        setFilter('');
        setCurrentStep('ollamaConfirm');
    };

    const handleOllamaCheckAndProceed = useCallback(async (confirmInstall: boolean) => {
        setOllamaChecked(confirmInstall);
        if (confirmInstall) {
            setIsProcessing(true);
            setOllamaStatus("checking");
            setOllamaMessage("Verifying Ollama installation...");
            const result = await checkOllama();
            setOllamaStatus(result.ok ? "ok" : "error");
            setOllamaMessage(result.ok ? `Ollama detected (Version: ${result.version || 'N/A'}).` : (result.error || "Ollama not found or not running."));
            setIsProcessing(false);
        } else {
            setOllamaStatus("idle");
            setOllamaMessage("Ollama not checked. LLM services may be unavailable.");
        }
        setCurrentStep('submitting');
    }, []);
    
    useEffect(() => {
        if (currentStep === 'submitting') {
            const finalSubmit = async () => {
                setIsProcessing(true);
                setSubmitError(null);
                if (!formData.username || !formData.providerId || !formData.providerAk || !formData.deviceName || !formData.countryName || !formData.stateName || !formData.cityName) {
                    setSubmitError("Critical error: Not all form data is available. Please restart setup.");
                    setIsProcessing(false);
                    setCurrentStep('basicInfo'); 
                    return;
                }
                const completeSessionData: UserSessionData = {
                    username: formData.username, providerId: formData.providerId, providerAk: formData.providerAk,
                    deviceId: 'to-be-assigned-by-backend', 
                    location: { country: formData.countryName, state: formData.stateName, city: formData.cityName },
                    deviceName: formData.deviceName,
                };
                try {
                    onSetupComplete(completeSessionData);
                } catch (e: any) { setSubmitError(e.message || "Final registration failed."); } 
                finally { setIsProcessing(false); }
            };
            finalSubmit();
        }
    }, [currentStep, formData, onSetupComplete]);

    const formProps: FormProps = useMemo(() => {
        let title = '', fields: FormField[] = [], sectionTitle = '';
        if (currentStep === 'basicInfo') {
            title = 'Account & Device Information'; sectionTitle = 'Step 1: Basic Details';
            fields = [
                {type: 'string', name: 'username', label: 'Username', initialValue: formData.username || ''},
                {type: 'string', name: 'providerId', label: 'Provider ID (from Cxmpute Dashboard)', initialValue: formData.providerId || ''},
                {type: 'string', name: 'providerAk', label: 'Provider API Key (from Cxmpute Dashboard)', mask:'*', initialValue: formData.providerAk || ''},
                {type: 'string', name: 'deviceName', label: 'Device Name (nickname for this machine)', initialValue: formData.deviceName || ''},
            ];
        } else if (currentStep === 'ollamaConfirm') {
            title = 'Optional Software Check'; sectionTitle = 'Step 5: Ollama (Recommended)';
            fields = [{ type: 'boolean', name: 'confirmOllama', label: 'Is Ollama installed and running?', initialValue: ollamaChecked }];
        }
        return {
            form: { title, sections: [{ title: sectionTitle, fields }] },
            onSubmit: (values: any) => {
                setSubmitError(null);
                if (currentStep === 'basicInfo') {
                    setFormData(prev => ({...prev, ...values}));
                    setCurrentStep('selectingCountry');
                } else if (currentStep === 'ollamaConfirm') {
                    handleOllamaCheckAndProceed(values.confirmOllama);
                }
            }
        };
    }, [currentStep, formData.username, formData.providerId, formData.providerAk, formData.deviceName, ollamaChecked, handleOllamaCheckAndProceed]);

    // Custom input handler for filter text
    useInput((input, key) => {
        if (key.escape) {
            if (currentStep === 'selectingCity') setCurrentStep('selectingState');
            else if (currentStep === 'selectingState') setCurrentStep('selectingCountry');
            else if (currentStep === 'selectingCountry') setCurrentStep('basicInfo');
            else if (currentStep === 'ollamaConfirm' && ollamaStatus !== "checking") setCurrentStep('selectingCity');
            setFilter('');
        } else if (key.backspace || key.delete) {
            setFilter(prev => prev.slice(0, -1));
        } else if (input && !key.ctrl && !key.meta && !key.tab && !key.upArrow && !key.downArrow && !key.leftArrow && !key.rightArrow && !key.return) {
            // Append regular characters, ignore control keys for SelectInput navigation
            setFilter(prev => prev + input);
        }
    }, { isActive: isCustomInputFocused && !isProcessing });


    if (isProcessing || currentStep === 'submitting') {
        return (
            <Box padding={1} flexDirection="column" alignItems="flex-start">
                <Text><Spinner type="dots"/> {ollamaStatus === "checking" ? ollamaMessage : "Processing your registration..."}</Text>
                {submitError && <Text color="red">{submitError}</Text>}
            </Box>
        );
    }

    const renderCustomSelectionUI = () => {
        let promptText = '';
        let currentItemHandler: ((item: SelectOption) => void) | undefined = undefined;
        let placeholder = "Type to filter...";

        if (currentStep === 'selectingCountry') {
            promptText = 'Search and select your Country:';
            currentItemHandler = handleCountrySelect;
        } else if (currentStep === 'selectingState') {
            promptText = `Country: ${formData.countryName}. Search State/Province:`;
            currentItemHandler = handleStateSelect;
            if (statesOfSelectedCountry.length === 0 && !filter) placeholder = "No states found, or type to search...";
        } else if (currentStep === 'selectingCity') {
            promptText = `State: ${formData.stateName}. Search City:`;
            currentItemHandler = handleCitySelect;
            if (citiesOfSelectedState.length === 0 && !filter) placeholder = "No cities found, or type to search...";
        } else {
            return null;
        }

        return (
            <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan" width="100%">
                <Box justifyContent="center" marginBottom={1}><Text bold color="yellow">Cxmpute Provider Setup</Text></Box>
                <Text>{promptText} ({activeSelectionOptions.length} matches)</Text>
                
                <Box borderStyle="single" paddingX={1} borderColor={isCustomInputFocused ? "blue" : "gray"}>
                    <Text>{filter || <Text dimColor>{placeholder}</Text>}</Text>
                    {isCustomInputFocused && <BlinkingCursor/>}
                </Box>
                <Newline/>
                {activeSelectionOptions.length > 0 ? (
                    <SelectInput 
                        items={activeSelectionOptions} 
                        onSelect={currentItemHandler}
                        itemComponent={({label, isSelected}) => (
                            <Text color={isSelected ? "cyan" : undefined}>{label}</Text>
                        )}
                        limit={MAX_DISPLAY_ITEMS}
                        initialIndex={0}
                        indicatorComponent={({isSelected}) => isSelected ? <Text color="cyan">❯ </Text> : <Text> </Text>}
                    />
                ) : (
                    <Text color="gray">{filter ? 'No matches found. Try a different search term or press Esc to go back.' : (currentStep === 'selectingState' && statesOfSelectedCountry.length === 0 ? 'No states listed for this country. Press Esc to re-select country.' : (currentStep === 'selectingCity' && citiesOfSelectedState.length === 0 ? 'No cities listed for this state/country. Press Esc to re-select state.' : 'Type to search...'))}</Text>
                )}
                {submitError && <Box marginTop={1}><Text color="red">Error: {submitError}</Text></Box>}
                <Newline/>
                <Text dimColor>Use ↑/↓ arrows, Enter to select. Esc to go back.</Text>
                <Text dimColor>Type to filter the list above.</Text>
            </Box>
        );
    };
    
    if (['selectingCountry', 'selectingState', 'selectingCity'].includes(currentStep)) {
        return renderCustomSelectionUI();
    }
    
    return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
            <Box justifyContent="center" marginBottom={1}><Text bold color="yellow">Cxmpute Provider Setup</Text></Box>
            <Text dimColor>Please follow the steps to register your device. Use arrow keys and Enter.</Text>
            <Newline/>
            <Form {...formProps} />
            <Newline/>
            {ollamaStatus !== 'idle' && ollamaStatus !== 'checking' && currentStep === 'ollamaConfirm' && (
                 <Box flexDirection="column" marginTop={1} borderStyle="single" paddingX={1} borderColor={ollamaStatus === 'error' ? "red" : "gray"}>
                    <Text color={ollamaStatus === 'error' ? "red" : "green"}>{ollamaMessage}</Text>
                 </Box>
            )}
            {submitError && <Box marginTop={1}><Text color="red">Error: {submitError}</Text></Box>}
            <Newline/>
            <Text dimColor>Press ESC to navigate back or clear a field (behavior depends on context).</Text>
        </Box>
    );
}