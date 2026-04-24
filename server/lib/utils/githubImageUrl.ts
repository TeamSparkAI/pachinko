interface HasCatalogIcon {
  serverCatalogIcon?: string;
}

export function getServerIconUrl(server: HasCatalogIcon | null | undefined): string {
  return server?.serverCatalogIcon ?? '/mcp_black.png';
}
