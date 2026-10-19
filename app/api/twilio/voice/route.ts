import { sql } from '@/lib/db';
import { readTwilio, twiml, say, appUrl, xmlEscape } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { params, ok, query } = await readTwilio(req);
  if (!ok) return new Response('Forbidden', { status: 403 });
  const id = Number(query.get('id'));
  const rows = await sql`select * from call_log where id = ${id}`;
  const row = rows[0];
  if (!row) return twiml('<Hangup/>');

  const machine = (params.AnsweredBy || '').startsWith('machine') || params.AnsweredBy === 'fax';
  if (machine && !row.voicemail) {
    await sql`update call_log set status = 'machine-hangup', answered_by = ${params.AnsweredBy}, updated_at = now() where id = ${id}`;
    return twiml('<Hangup/>');
  }
  const times = Math.max(1, row.repeat || 1);
  const pause = Math.max(0, row.pause ?? 2);
  let inner = '';
  for (let i = 0; i < times; i++) {
    inner += say(row.message || '');
    if (i < times - 1 && pause) inner += `<Pause length="${pause}"/>`;
  }
  if (row.press_one && !machine) {
    const action = xmlEscape(`${appUrl()}/api/twilio/gather?id=${id}`);
    inner += `<Gather numDigits="1" timeout="6" action="${action}" method="POST">${say('To hear this message again, press 1.')}</Gather>`;
  }
  return twiml(inner);
}
