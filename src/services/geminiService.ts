
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// Helper to safely retrieve the API key
const getApiKey = (): string | undefined => {
    // Standard Next.js environment variable
    return process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
};

const timeout = (ms: number) => new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms / 1000} seconds`)), ms)
);

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 2000, timeoutMs = 90000): Promise<T> {
    try {
        return await Promise.race([fn(), timeout(timeoutMs)]);
    } catch (error: any) {
        const isTimeout = error.message && error.message.includes('timed out');
        const isOverloaded = error.status === 503 || error.status === 429 || error.code === 503 || error.code === 429;

        if (retries > 0 && (isOverloaded || isTimeout)) {
            console.warn(`AI Generation failed (${error.message || error.status}). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return withRetry(fn, retries - 1, delay * 1.5, timeoutMs);
        }
        throw error;
    }
}

export interface ParsedMenuDay {
    date: string; // YYYY-MM-DD
    options: {
        name: string;
        description: string;
        availableCondiments: string[];
    }[];
}

export interface GeneratedQuestion {
    text: string;
    type: 'mcq' | 'true_false';
    options: string[];
    correctAnswer: string;
    category: string;
}

export interface QuestionImprovement {
    critique: string;
    improvedText: string;
    improvedOptions: string[];
    reasoning: string;
}

export interface RosterAssignment {
    staffId: string;
    date: string;
    dutyCodeId: string;
    reason?: string;
}

export interface GeneratedTemplateData {
    name: string;
    sections: {
        title: string;
        items: {
            label: string;
            description: string;
            type: 'rating' | 'text';
        }[];
    }[];
}

export const parseMenuImage = async (
    file: File,
    year: number,
    month: number
): Promise<ParsedMenuDay[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Gemini API Key missing.");

    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-3-flash-preview';

    // Convert file to base64
    const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[month - 1];

    const prompt = `You are a data extraction specialist. Analyze this menu image for ${monthName} ${year}.
    Extract each row representing a date.
    
    Rules:
    1. The dates are usually in the first column (e.g. "01 / 02" means Feb 1st).
    2. Extract all dishes listed in "Dish 1", "Dish 2", and "Dish 3" columns.
    3. Look for a footer regarding daily sides/condiments (e.g. "Sides served daily: Chutney, Salad, Lentils, Chili").
    4. If sides are found, include them in the 'availableCondiments' array for EVERY dish.
    5. Return the full date as YYYY-MM-DD.
    
    Output Format: A JSON array of objects.`;

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: model,
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: file.type,
                            data: base64Data
                        }
                    }
                ]
            }
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING },
                        options: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    availableCondiments: { type: Type.ARRAY, items: { type: Type.STRING } }
                                },
                                required: ["name", "availableCondiments"]
                            }
                        }
                    },
                    required: ["date", "options"]
                }
            }
        }
    }));

    if (response.text) {
        return JSON.parse(response.text) as ParsedMenuDay[];
    }
    throw new Error("No data returned from AI");
};

export const generateExamQuestions = async (
    topic: string,
    count: number = 5,
    difficulty: string = 'Medium'
): Promise<GeneratedQuestion[]> => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error("Gemini API Key is missing. Please configure NEXT_PUBLIC_GEMINI_API_KEY.");
        }

        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-3-flash-preview';

        const prompt = `You are an expert aviation examiner. Create ${count} ${difficulty}-level exam questions about: "${topic}"

    Requirements:
    1. Relevant to aviation operations/safety.
    2. 4 options for MCQ.
    3. Correct answer must be in options.
    4. Category field required.
    `;

        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            text: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ["mcq", "true_false"] },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswer: { type: Type.STRING },
                            category: { type: Type.STRING }
                        },
                        required: ["text", "type", "options", "correctAnswer", "category"],
                    },
                },
            },
        }));

        if (response.text) {
            return JSON.parse(response.text) as GeneratedQuestion[];
        }

        throw new Error("No data returned from AI");

    } catch (error: any) {
        console.error("AI Generation Error:", error);
        const msg = error.message || "Unknown error";
        if (msg.includes("API Key")) throw new Error("Configuration Error: Gemini API Key is missing or invalid.");
        if (msg.includes("503") || msg.includes("429")) throw new Error("AI Service overloaded. Please try again.");
        throw new Error(`Failed to generate: ${msg}`);
    }
};

export const improveQuestion = async (
    questionText: string,
    correctAnswer: string,
    options: string[]
): Promise<QuestionImprovement> => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error("Gemini API Key missing");

        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-3-flash-preview';

        const prompt = `Review this aviation question for clarity and accuracy.
        Question: "${questionText}"
        Correct: "${correctAnswer}"
        Distractors: ${options.filter(o => o !== correctAnswer).join(', ')}
        
        Return JSON with: critique, improvedText, improvedOptions (4 items), reasoning.`;

        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        critique: { type: Type.STRING },
                        improvedText: { type: Type.STRING },
                        improvedOptions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        reasoning: { type: Type.STRING }
                    }
                }
            }
        }));

        if (response.text) {
            return JSON.parse(response.text) as QuestionImprovement;
        }
        throw new Error("No improvement data returned");
    } catch (error: any) {
        console.error("AI Improvement Error:", error);
        throw error;
    }
}

export const generateRosterDraft = async (
    instructions: string,
    context: {
        month: string;
        daysInMonth: number;
        staff: { id: string; name: string; role: string }[];
        codes: { id: string; code: string; description: string; isOff: boolean }[];
        leave: { staffId: string; date: string; type: string }[];
    }
): Promise<RosterAssignment[]> => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error("Gemini API Key missing");

        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-3-pro-preview';

        const prompt = `
        Role: Expert Roster Scheduler.
        Task: Create a daily roster schedule based on provided instructions and context.

        Context:
        - Month: ${context.month}
        - Days in Month: ${context.daysInMonth}
        
        Staff List:
        ${JSON.stringify(context.staff)}

        Shift Codes:
        ${JSON.stringify(context.codes)}

        Existing Leave (Do not schedule conflicts):
        ${JSON.stringify(context.leave)}

        User Instructions:
        "${instructions}"

        Output Requirement:
        Return a JSON array of assignments. Each assignment object must contain:
        - staffId (string, from Staff List)
        - date (string, YYYY-MM-DD format)
        - dutyCodeId (string, from Shift Codes)
        - reason (optional string, brief explanation if logic was complex)
        
        Only generate assignments that are necessary. You do not need to fill every day for every person if the instructions imply a sparse roster or pattern. If instructions say "Assign 5 days on", only assign those days.
        `;

        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            staffId: { type: Type.STRING },
                            date: { type: Type.STRING },
                            dutyCodeId: { type: Type.STRING },
                            reason: { type: Type.STRING }
                        },
                        required: ["staffId", "date", "dutyCodeId"]
                    }
                }
            }
        }));

        if (response.text) {
            return JSON.parse(response.text) as RosterAssignment[];
        }
        throw new Error("No roster data generated.");

    } catch (error: any) {
        console.error("AI Roster Generation Error:", error);
        throw error;
    }
};

export const generatePerformanceTemplate = async (
    role: string,
    focusAreas: string
): Promise<GeneratedTemplateData> => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error("Gemini API Key missing");

        const ai = new GoogleGenAI({ apiKey });
        const model = 'gemini-3-flash-preview';

        const prompt = `
        Role: Aviation HR Specialist.
        Task: Create a comprehensive Performance Review Template structure for the job role: "${role}".
        
        Focus Areas / Specific Instructions:
        "${focusAreas}"

        Requirements:
        1. Professional, aviation-appropriate language.
        2. Create 3-5 distinct sections (e.g. Flight Skills, Safety Culture, Leadership).
        3. Each section should have 3-5 specific criteria items.
        4. Include a clear description for each item to guide the reviewer.
        5. Use 'rating' type for measurable skills, 'text' for open feedback.
        `;

        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        sections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    items: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                label: { type: Type.STRING },
                                                description: { type: Type.STRING },
                                                type: { type: Type.STRING, enum: ['rating', 'text'] }
                                            },
                                            required: ['label', 'type', 'description']
                                        }
                                    }
                                },
                                required: ['title', 'items']
                            }
                        }
                    },
                    required: ['name', 'sections']
                }
            }
        }));

        if (response.text) {
            return JSON.parse(response.text) as GeneratedTemplateData;
        }
        throw new Error("No template data generated.");

    } catch (error: any) {
        console.error("AI Template Generation Error:", error);
        throw error;
    }
};
