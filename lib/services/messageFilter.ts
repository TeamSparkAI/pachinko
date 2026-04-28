import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { JsonRpcMessageWrapper } from '@/lib/jsonrpc';
import { MessageFilterContext } from '@/lib/types/messageFilterContext';
import { MessageData } from '@/lib/models/types/message';
import { AlertReadData } from '@/lib/models/types/alert';
import { MessageActionData } from '@/lib/models/types/messageAction';
import { logger } from '@/lib/logging/server';
import { PolicyEngine } from '../policy-engine/core';
import { DEFAULT_TENANT_ID } from '@/lib/auth/constants';
import { getModelFactory } from '../models';

export interface MessageFilterResult {
    success: boolean;
    error?: string;
    message: JSONRPCMessage;
}

async function isLuhnValid(number: string): Promise<boolean> {
    const digits = number.replace(/\D/g, '');

    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i], 10);
        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        sum += digit;
        isEven = !isEven;
    }

    logger.debug(`Luhn check on ${number}: Sum: ${sum}, divisible by 10: ${sum % 10 === 0}`);
    return sum % 10 === 0;
}

const KEYWORD_WINDOW_SIZE = 100;

type PayloadType = 'params' | 'result';

interface StringFieldValue {
    path: string;
    value: string;
}

function getStringFieldValues(obj: unknown, path: string = ''): StringFieldValue[] {
    const results: StringFieldValue[] = [];

    if (typeof obj === 'string') {
        results.push({ path, value: obj });
    } else if (typeof obj === 'object' && obj !== null) {
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                const itemPath = `${path}[${i}]`;
                results.push(...getStringFieldValues((obj as unknown[])[i], itemPath));
            }
        } else {
            for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
                const propertyPath = path ? `${path}.${key}` : key;
                results.push(...getStringFieldValues(value, propertyPath));
            }
        }
    }

    return results;
}

export async function applyPolicies(
    messageData: MessageData,
    message: JsonRpcMessageWrapper,
    tenantId: number = DEFAULT_TENANT_ID
): Promise<JsonRpcMessageWrapper> {
    const modelFactory = getModelFactory();
    const policyModel = await modelFactory.getPolicyModel(tenantId);
    const policies = await policyModel.list();

    const applicablePolicies = policies.filter((policy) => {
        if (!policy.enabled) {
            return false;
        }
        if (policy.origin !== 'either' && policy.origin !== message.origin) {
            return false;
        }
        const matchTk = policy.matchToolkit?.trim();
        if (matchTk && messageData.payloadToolkit !== matchTk) {
            return false;
        }
        const matchTool = policy.matchTool?.trim();
        if (matchTool && (messageData.payloadToolName ?? '') !== matchTool) {
            return false;
        }
        return true;
    });

    const result = await PolicyEngine.processMessage(messageData, message, applicablePolicies);

    const alertMap = new Map<string, AlertReadData>();
    const alertModel = await modelFactory.getAlertModel(tenantId);
    for (const policyFinding of result.policyFindings) {
        for (const filterFinding of policyFinding.conditionFindings) {
            if (filterFinding.findings.length > 0) {
                const alert = await alertModel.create({
                    messageId: messageData.messageId,
                    timestamp: messageData.timestamp,
                    policyId: policyFinding.policy.policyId,
                    origin: message.origin,
                    condition: filterFinding.condition,
                    findings: filterFinding.findings,
                });
                alertMap.set(filterFinding.condition.instanceId, alert);
            }
        }
    }

    const messageActions: MessageActionData[] = [];
    const messageActionModel = await modelFactory.getMessageActionModel(tenantId);
    for (const policyAction of result.policyActions) {
        for (const actionResult of policyAction.actionResults) {
            for (const actionEvent of actionResult.actionEvents) {
                if (actionEvent.conditionInstanceId) {
                    actionEvent.alertId = alertMap.get(actionEvent.conditionInstanceId)?.alertId;
                }
            }
            const messageAction = await messageActionModel.create({
                messageId: messageData.messageId,
                policyId: policyAction.policy.policyId,
                origin: message.origin,
                severity: policyAction.policy.severity,
                action: actionResult.action,
                actionEvents: actionResult.actionEvents,
                timestamp: messageData.timestamp,
            });
            messageActions.push(messageAction);
        }
    }

    const modifiedMessage = PolicyEngine.applyModifications(message, messageActions);

    return modifiedMessage;
}

export class MessageFilterService {
    /**
     * Process and store a JSON-RPC message.
     * @param filterContext Caller context (user, toolkit, source, …)
     * @param message The JSON-RPC message to process
     * @param timestamp Optional timestamp for the message record
     */
    static async processMessage(
        filterContext: MessageFilterContext,
        message: JsonRpcMessageWrapper,
        timestamp?: Date,
        tenantId: number = DEFAULT_TENANT_ID
    ): Promise<MessageFilterResult> {
        try {
            const modelFactory = getModelFactory();
            const messageModel = await modelFactory.getMessageModel(tenantId);

            let messageData: MessageData | null = null;
            if (message.origin === 'server' && message.messageId) {
                const messages = await messageModel.list(
                    { payloadMessageId: message.messageId },
                    { sort: 'desc', limit: 1 }
                );

                if (messages.messages.length > 0) {
                    messageData = await messageModel.update(messages.messages[0].messageId, {
                        payloadResult: message.result ?? undefined,
                        payloadError: message.errorMessage
                            ? { code: message.errorCode, message: message.errorMessage }
                            : undefined,
                        timestampResult: timestamp?.toISOString() || new Date().toISOString(),
                    });
                } else {
                    messageData = await messageModel.create({
                        timestamp: timestamp?.toISOString() || new Date().toISOString(),
                        origin: message.origin,
                        userId: filterContext?.user ?? 'unknown',
                        source: filterContext.source ?? null,
                        payloadToolkit: filterContext.payloadToolkit ?? '',
                        payloadToolVersion: filterContext.payloadToolVersion ?? '',
                        payloadMessageId: message.messageId || '',
                        payloadMethod: message.method || '',
                        payloadToolName: '',
                        payloadParams: message.params || null,
                        payloadResult: message.result || null,
                        payloadError: message.errorMessage
                            ? { code: message.errorCode, message: message.errorMessage }
                            : null,
                    });
                }
            } else {
                let payloadToolName = '';
                if (message.method === 'tools/call') {
                    payloadToolName = message.params?.name || '';
                }
                messageData = await messageModel.create({
                    timestamp: timestamp?.toISOString() || new Date().toISOString(),
                    origin: message.origin,
                    userId: filterContext?.user ?? 'unknown',
                    source: filterContext.source ?? null,
                    payloadToolkit: filterContext.payloadToolkit ?? '',
                    payloadToolVersion: filterContext.payloadToolVersion ?? '',
                    payloadMessageId: message.messageId || '',
                    payloadMethod: message.method || '',
                    payloadToolName,
                    payloadParams: message.params || null,
                    payloadResult: null,
                    payloadError: null,
                });
            }

            const filteredMessage = await applyPolicies(messageData, message, tenantId);

            return {
                success: true,
                message: filteredMessage.toJSON(),
            };
        } catch (error) {
            logger.error('Error storing message with jsonc filtering:', error);
            return {
                success: false,
                message: message.toJSON(),
                error: 'Failed to store message',
            };
        }
    }
}
