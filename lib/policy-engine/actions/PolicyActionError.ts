import { PolicyActionBase } from "./PolicyActionBase";
import { JsonSchema, ValidationResult, ActionEventWithConditionId } from "../types/core";
import { ConditionFindings } from "../core";
import { JsonRpcMessageWrapper } from "@/lib/jsonrpc";
import { MessageData } from "@/lib/models/types/message";

export class PolicyActionError extends PolicyActionBase {
    constructor() {
        super('error', 'Return Error', 'Block with an error message (policy deny)');
    }

    get configSchema(): JsonSchema | null { return null; }
    get configValidator(): ((config: any) => ValidationResult) | null { return null; }

    get paramsSchema(): JsonSchema {
        return {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    title: 'Error message',
                    description: 'Message shown to the client or Arcade agent when this action runs',
                    default: 'An error occurred',
                },
            },
            required: ['message'],
        };
    }

    get paramsValidator(): ((params: any) => ValidationResult) | null {
        return (params: any): ValidationResult => {
            if (!params.message || typeof params.message !== 'string') {
                return {
                    isValid: false,
                    error: 'Error message is required and must be a string',
                };
            }

            return { isValid: true };
        };
    }

    async applyAction(
        messageData: MessageData,
        message: JsonRpcMessageWrapper, 
        conditionFindings: ConditionFindings[], 
        config: any, 
        params: any
    ): Promise<ActionEventWithConditionId[]> {
        return [{
            details: `Policy error: ${params.message}`,
            metadata: {
                findingsCount: conditionFindings.length // !!! This is really just an example of setting metadata for an action result
            },
            contentModification: {
                type: 'message',
                payload: { error: { message: params.message } },
            },
        }];
    }
}
