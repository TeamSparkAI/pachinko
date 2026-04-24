import React from 'react';

interface ServerLogsTabProps {
  serverToken: string;
}

/** Bridge transport logs were removed with the in-process MCP gateway. */
export function ServerLogsTab(_props: ServerLogsTabProps) {
  return (
    <p className="text-sm text-gray-500">
      Live bridge logs are not available without the MCP gateway. Use application logs or your deployment platform for
      process output.
    </p>
  );
} 