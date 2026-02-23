
export interface LunchMenu {
    date: string; // YYYY-MM-DD
    cutoffTime: string; // ISO
    options: LunchOption[];
    manualEligibleStaff?: string[]; // IDs
}

export interface LunchOption {
    id: string;
    name: string;
    description?: string;
    availableCondiments?: string[]; // List of available sides/condiments
}

export interface LunchOrder {
    date: string;
    staffId: string;
    optionId: string;
    notes?: string;
    selectedCondiments?: string[]; // List of selected condiments
}
