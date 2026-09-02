import { Category, KnowledgeItem, RegUpdate } from '../types';

export type HomeStackParamList = {
  Home: undefined;
  Category: { cat: Category };
  Detail: { item: KnowledgeItem };
  Search: undefined;
};

export type AskStackParamList = {
  Ask: undefined;
};

export type UpdatesStackParamList = {
  UpdatesList: undefined;
  UpdateDetail: { update: RegUpdate };
};

export type AboutStackParamList = {
  About: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  AskTab: undefined;
  UpdatesTab: undefined;
  AboutTab: undefined;
};
