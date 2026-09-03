import { Category, KnowledgeItem, RegUpdate } from '../types';
import { Finding, LedgerEntry } from '../types/audit';

export type AuditStackParamList = {
  AuditHome: undefined;
  AuditSettings: undefined;
  ImportLedger: undefined;
  ConnectAccounting: undefined;
  LedgerDetail: { ledgerId: string; ledgerName: string };
  FindingDetail: { finding: Finding; entries: LedgerEntry[] };
};

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
  AuditTab: undefined;
  AboutTab: undefined;
};
