import { neon } from '@neondatabase/serverless';

let _sql: any = null;

/** Tagged-template SQL against Neon. Created lazily so builds work without env. */
export function sql(strings: TemplateStringsArray, ...values: any[]): Promise<any[]> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    _sql = neon(url);
  }
  return _sql(strings, ...values);
}

export const json = (v: any) => JSON.stringify(v ?? null);
