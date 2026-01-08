
export enum LocationType {
  URBAN = 'URBAN',
  RURAL = 'RURAL',
  COASTAL = 'COASTAL'
}

export interface BudgetLineItem {
  category: string;
  item: string;
  estimate: string;
  source: string;
}

export interface InteriorItem {
  name: string;
  price: string;
  buyLink: string;
}

export interface ProjectRecord {
  id: string;
  clientId: string;
  clientName: string;
  buildingName: string;
  date: string;
  totalArea: number;
  length: number;
  breadth: number;
  buildingType: string;
  location: LocationType;
  budget: string;
  mainColor: string;
  style: string;
  floors: number;
  roomsPerFloor: number;
  beforeImage?: string;
  afterImage?: string;
  afterImageSide?: string;
  interiorImage?: string;
  constructionSteps?: string;
  budgetBreakdown?: BudgetLineItem[];
}

export interface RoomRecord {
  id: string;
  clientId: string;
  type: string;
  length: number;
  breadth: number;
  area: number;
  budget?: string;
  primaryColor: string;
  colorRange: 'warm' | 'cool' | 'neutral' | 'vibrant';
  beforeImage?: string;
  afterImage?: string;
  date: string;
  items?: InteriorItem[];
}

export type Language = 'en' | 'hi' | 'te';

export interface TranslationDictionary {
  [key: string]: {
    [lang in Language]: string;
  };
}

export interface User {
  id: string;
  username: string;
  role: 'CLIENT' | 'DEVELOPER';
  fullName: string;
}
