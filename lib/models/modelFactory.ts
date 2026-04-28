import type { MessageModel } from './message';
import type { PolicyModel } from './policy';
import type { AlertModel } from './alert';
import type { PolicyElementModel } from './policyElement';
import type { MessageActionModel } from './messageAction';
import type { AppSettingsModel } from './appSettings';

/** Contract for the app’s persistence-backed model accessors (any DB implementation). */
export interface IModelFactory {
  initialize(): Promise<void>;
  getMessageModel(tenantId?: number): Promise<MessageModel>;
  getPolicyModel(tenantId?: number): Promise<PolicyModel>;
  getAlertModel(tenantId?: number): Promise<AlertModel>;
  getPolicyElementModel(tenantId?: number): Promise<PolicyElementModel>;
  getMessageActionModel(tenantId?: number): Promise<MessageActionModel>;
  getAppSettingsModel(tenantId?: number): Promise<AppSettingsModel>;
  analyze(): Promise<void>;
}
