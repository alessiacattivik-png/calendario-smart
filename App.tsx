
import React, { useState, useEffect, useCallback } from 'react';
import type { CalendarEvent, ChatMessage, Settings, AIAssistantAction } from './types';
import { CalendarView } from './components/CalendarView';
import { ChatAssistant } from './components/ChatAssistant';
import { SettingsModal } from './components/SettingsModal';
import { SettingsIcon } from './components/Icons';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { processNaturalLanguage, generateSummaryText } from './services/geminiService';

const App: React.FC = () => {
    const [events, setEvents] = useState<CalendarEvent[]>([
        { id: '1', title: "Riunione team", date: new Date().toISOString().split('T')[0], time: '10:00', description: 'Meeting di pianificazione settimanale.' },
        { id: '2', title: "Pranzo con cliente", date: new Date().toISOString().split('T')[0], time: '13:00' },
    ]);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: 'init', sender: 'assistant', text: 'Ciao! Sono il tuo assistente per il calendario. Come posso aiutarti oggi?', timestamp: new Date().toISOString() }
    ]);
    const [userInput, setUserInput] = useState('');
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState<Settings>({
        wakeWord: 'assistente',
        summaryTime: '08:00',
    });
    const [lastSummaryDate, setLastSummaryDate] = useState<string | null>(null);

    const addMessage = (text: string, sender: 'user' | 'assistant' | 'system') => {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender, text, timestamp: new Date().toISOString() }]);
    };
    
    const handleAIAction = useCallback((action: AIAssistantAction) => {
        switch (action.type) {
            case 'CREATE_EVENT':
                const newEvent: CalendarEvent = { id: Date.now().toString(), ...action.payload };
                setEvents(prev => [...prev, newEvent]);
                addMessage(`Ho creato l'evento: "${newEvent.title}" per il ${new Date(newEvent.date).toLocaleDateString('it-IT')} alle ${newEvent.time}.`, 'assistant');
                break;
            
            case 'READ_EVENTS':
                const dateToRead = action.payload.date;
                const eventsOnDate = events.filter(e => e.date === dateToRead);
                const summaryText = generateSummaryText(eventsOnDate, 'today'); // Simplified for this case
                addMessage(summaryText, 'assistant');
                break;

            case 'SUMMARIZE_EVENTS':
                const { period } = action.payload;
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];
                let relevantEvents: CalendarEvent[] = [];
                
                if (period === 'today') {
                    relevantEvents = events.filter(e => e.date === todayStr);
                } else if (period === 'tomorrow') {
                    const tomorrow = new Date();
                    tomorrow.setDate(today.getDate() + 1);
                    const tomorrowStr = tomorrow.toISOString().split('T')[0];
                    relevantEvents = events.filter(e => e.date === tomorrowStr);
                } // 'this_week' logic can be added here
                
                addMessage(generateSummaryText(relevantEvents, period), 'assistant');
                break;

            case 'OPEN_PROGRAM':
                const { programName } = action.payload;
                addMessage(`Ok, provo ad aprire ${programName}...`, 'assistant');
                window.location.href = `${programName}://`;
                break;

            case 'GENERAL_RESPONSE':
                addMessage(action.payload.text, 'assistant');
                break;

            case 'ERROR':
                addMessage(`Errore: ${action.payload.message}`, 'system');
                break;
        }
    }, [events]);

    const processCommand = useCallback(async (command: string) => {
        if (!command.trim() || isAiThinking) return;
        addMessage(command, 'user');
        setIsAiThinking(true);
        try {
            const action = await processNaturalLanguage(command, events);
            handleAIAction(action);
        } catch (error) {
            console.error("Error processing command:", error);
            addMessage("Si è verificato un errore inaspettato.", 'system');
        } finally {
            setIsAiThinking(false);
        }
    }, [isAiThinking, events, handleAIAction]);


    const onCommand = useCallback((command: string) => {
        setUserInput(command);
        // Using a timeout to allow state to update before submitting
        setTimeout(() => {
            processCommand(command);
            setUserInput('');
        }, 50);
    }, [processCommand]);

    const { isListening, isSupported } = useSpeechRecognition(settings, onCommand);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        processCommand(userInput);
        setUserInput('');
    };

    // Effect for daily summary
    useEffect(() => {
        const checkTime = () => {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            const todayStr = now.toISOString().split('T')[0];
            
            if (currentTime === settings.summaryTime && lastSummaryDate !== todayStr) {
                setLastSummaryDate(todayStr);
                processCommand("fai un riassunto della giornata di oggi");
            }
        };

        const intervalId = setInterval(checkTime, 30000); // Check every 30 seconds
        return () => clearInterval(intervalId);
    }, [settings.summaryTime, lastSummaryDate, processCommand]);

    return (
        <div className="h-full w-full p-4 lg:p-6 flex flex-col lg:flex-row gap-6 bg-slate-100">
            <SettingsModal 
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                currentSettings={settings}
                onSave={setSettings}
            />
            
            <header className="absolute top-4 right-6 flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    {isSupported ? (isListening ? 'Ascolto attivo...' : 'Voce disattivata') : 'Voce non supportata'}
                    <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                </div>
                <button onClick={() => setIsSettingsOpen(true)} className="text-slate-500 hover:text-sky-600 transition-colors p-2 rounded-full bg-white shadow">
                    <SettingsIcon className="w-6 h-6"/>
                </button>
            </header>

            {/* Main content grid */}
            <main className="h-full w-full grid grid-cols-1 lg:grid-cols-3 gap-6 pt-12">
                <div className="lg:col-span-2 h-full min-h-[500px] lg:min-h-0">
                    <CalendarView events={events} />
                </div>
                <div className="lg:col-span-1 h-full min-h-[500px] lg:min-h-0">
                    <ChatAssistant
                        messages={messages}
                        userInput={userInput}
                        setUserInput={setUserInput}
                        onSendMessage={handleSendMessage}
                        isListening={isListening}
                        isSupported={isSupported}
                        isAiThinking={isAiThinking}
                    />
                </div>
            </main>
        </div>
    );
};

export default App;
