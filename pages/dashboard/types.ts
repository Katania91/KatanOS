// Dashboard types - extracted from Dashboard.tsx

export interface OnThisDayEvent {
    year: number;
    text: string;
}

export interface CityResult {
    id: number;
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    admin1?: string;
}

export interface WikiOnThisDayEvent {
    year?: number;
    text?: string;
}
