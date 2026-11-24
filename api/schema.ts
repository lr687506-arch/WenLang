import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  send: (body: string) => void;
}

export default async function handler(_req: IncomingMessage, res: VercelResponse) {
  try {
    const schemaPath = path.resolve(process.cwd(), 'schema.sql');
    const sql = await fs.readFile(schemaPath, 'utf-8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(sql);
  } catch {
    res.setHeader('Content-Type', 'application/json');
    res.status(404).send(JSON.stringify({ error: 'Arquivo schema.sql não encontrado.' }));
  }
}
