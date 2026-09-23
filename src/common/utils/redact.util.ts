/** Strips the password out of a connection string before it reaches a log sink. */
export function redactConnectionString(url: string): string {
  return url.replace(/:\/\/([^:/@]+):[^@]*@/, '://$1:****@');
}
