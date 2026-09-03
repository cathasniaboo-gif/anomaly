import { JsonCollection } from '../db';
import { LedgerRecord, ConnectionRecord, OAuthStateRecord } from './types';

export const ledgersCollection = new JsonCollection<LedgerRecord>('audit-ledgers.json');
export const connectionsCollection = new JsonCollection<ConnectionRecord>('audit-connections.json');
export const oauthStatesCollection = new JsonCollection<OAuthStateRecord>('audit-oauth-states.json');
