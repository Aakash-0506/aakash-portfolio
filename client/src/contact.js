export const EMPTY_FORM = { name: '', email: '', subject: '', message: '', website: '' };

export function validateContact(form) {
  const errors = {};
  const name = form.name.trim();
  const email = form.email.trim();
  const subject = form.subject.trim();
  const message = form.message.trim();
  if (name.length < 2 || name.length > 100) errors.name = 'Enter a name between 2 and 100 characters.';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
  if (subject.length < 3 || subject.length > 150) errors.subject = 'Use a subject between 3 and 150 characters.';
  if (message.length < 10 || message.length > 5000) errors.message = 'Write a message between 10 and 5,000 characters.';
  return errors;
}

export async function sendContact(form, fetcher = fetch) {
  const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
  const response = await fetcher('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45000),
  });
  const data = await response.json().catch(() => null);
  if (response.status === 429) throw new Error('Too many messages. Please wait a few minutes before trying again.');
  if (!response.ok || !data?.saved) {
    throw new Error('Your message could not be submitted. Please email aakashgarude@gmail.com directly.');
  }
  if (data.emailSent) return { kind: 'success', text: 'Message sent! Thank you for getting in touch.' };
  return {
    kind: 'pending',
    text: 'Your message was saved, but the email notification was not sent. For a quicker reply, email aakashgarude@gmail.com directly.',
  };
}
