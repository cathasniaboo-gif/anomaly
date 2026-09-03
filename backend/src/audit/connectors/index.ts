import { AccountingConnector } from './types';
import { quickbooksConnector } from './quickbooks';
import { xeroConnector } from './xero';

export const connectors: Record<string, AccountingConnector> = {
  quickbooks: quickbooksConnector,
  xero: xeroConnector,
};

export function getConnector(id: string): AccountingConnector | undefined {
  return connectors[id];
}

export * from './types';
