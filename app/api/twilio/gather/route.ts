import { sql } from '@/lib/db';
import { readTwilio, twiml, say, appUrl, xmlEscape } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { params, ok, query } = await readTwilio(req);
  if (!ok) return new Response('Forbidden', { status: 403 });
  const id = Number(query.get('id'));
  if (params.Digits !== '1') return twiml('<Hangup/>');
  const rows = await sql`select message from call_log where id = ${id}`;
  if (!rows[0]) return twiml('<Hangup/>');
  const action = xmlEscape(`${appUrl()}/api/twilio/gather?id=${id}`);
  return twiml(
    say(rows[0].message || '') +
      `<Gather numDigits="1" timeout="6" action="${action}" method="POST">${say('To hear it again, press 1.')}</Gather>`,
  );
}
