export const EMPTY_FORM = { name: '', email: '', subject: '', message: '', website: '' };
const HAS_CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

export function validateContact(form) {
  const errors = {};
  const name = form.name.trim();
  const email = form.email.trim();
  const subject = form.subject.trim();
  const message = form.message.trim();
  if (name.length < 2 || name.length > 100 || HAS_CONTROL.test(name)) errors.name = 'Enter a name between 2 and 100 characters without control characters.';
  if (email.length > 254 || HAS_CONTROL.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
  if (subject.length < 3 || subject.length > 150 || HAS_CONTROL.test(subject)) errors.subject = 'Use a subject between 3 and 150 characters without control characters.';
  if (message.length < 10 || message.length > 5000) errors.message = 'Write a message between 10 and 5,000 characters.';
  return errors;
}

export async function sendContact(form, fetcher = fetch) {
  const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('The request timed out.', 'TimeoutError')), 45000);
  try {
    const response = await fetcher('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (response.status === 429) throw new Error('Too many messages. Please wait before trying again.');
    if (response.status === 400 && data?.errors && typeof data.errors === 'object') {
      const fieldErrors = {};
      for (const field of ['name', 'email', 'subject', 'message']) {
        const value = data.errors[field];
        if (Array.isArray(value) && typeof value[0] === 'string') fieldErrors[field] = value[0];
      }
      throw Object.assign(new Error('Please check your form fields.'), { fieldErrors });
    }
    if (response.status === 200 && data?.saved === true && data.emailSent === true)
      return { kind: 'success', text: 'Message sent! Thank you for getting in touch.' };
    if (response.status === 202 && data?.saved === true && data.emailSent === false)
      return {
        kind: 'pending',
        text: 'Your message was saved, but email delivery could not be confirmed. For a quicker reply, email aakashgarude@gmail.com directly.',
      };
    throw new Error('Your message could not be submitted. Please email aakashgarude@gmail.com directly.');
  } catch (error) {
    if (controller.signal.aborted) throw new DOMException('The request timed out.', 'TimeoutError');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
