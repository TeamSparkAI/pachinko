import React from 'react';
import { PolicyData } from '@/lib/models/types/policy';
import { getSeverityLevel } from '@/lib/severity';
import { ConditionDisplay } from './ConditionDisplay';
import { ActionDisplay } from './ActionDisplay';

interface PolicyDetailsTabProps {
  policy: PolicyData;
}

export function PolicyDetailsTab({ policy }: PolicyDetailsTabProps) {
  const severityLevel = getSeverityLevel(policy.severity);

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="border-t border-gray-200">
        <dl>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Severity</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  {React.cloneElement(severityLevel.icon as React.ReactElement, { size: 'xl' })}
                </div>
                <div>
                  <span className="font-medium">{policy.severity} - {severityLevel.name}</span>
                  <p className="text-gray-500 text-xs mt-1">{severityLevel.description}</p>
                </div>
              </div>
            </dd>
          </div>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Origin</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              {policy.origin.charAt(0).toUpperCase() + policy.origin.slice(1)}
            </dd>
          </div>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Toolkit / tool</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              {policy.matchToolkit?.trim() || policy.matchTool?.trim() ? (
                <div className="space-y-1 font-mono text-xs">
                  {policy.matchToolkit?.trim() ? (
                    <div>
                      <span className="text-gray-500">Toolkit:</span> {policy.matchToolkit.trim()}
                    </div>
                  ) : null}
                  {policy.matchTool?.trim() ? (
                    <div>
                      <span className="text-gray-500">Tool:</span> {policy.matchTool.trim()}
                    </div>
                  ) : null}
                </div>
              ) : (
                <span className="text-gray-500">All toolkits and tools</span>
              )}
            </dd>
          </div>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Conditions</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <div className="space-y-4">
                {policy.conditions.map((condition) => (
                  <ConditionDisplay key={condition.instanceId} condition={condition} />
                ))}
                {policy.conditions.length === 0 && (
                  <p className="text-gray-500">No conditions defined</p>
                )}
              </div>
            </dd>
          </div>
          <div className="bg-white even:bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-[120px_1fr] sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Actions</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0">
              <div className="space-y-4">
                {policy.actions.map((action) => (
                  <ActionDisplay key={action.instanceId} action={action} />
                ))}
                {policy.actions.length === 0 && (
                  <p className="text-gray-500">No actions defined</p>
                )}
              </div>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
} 