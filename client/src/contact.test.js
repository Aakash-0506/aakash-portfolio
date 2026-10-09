import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FORM, sendContact, validateContact } from './contact.js';

const valid = { name: 'Alex Smith', email: 'alex@example.com', subject: 'Say hello', message: 'I would like to get in touch.', website: '' };

test('empty, malformed and overlong form fields are rejected', () => {
  assert.deepEqual(Object.keys(validateContact(EMPTY_FORM)), ['name', 'email', 'subject', 'message']);
  assert.ok(validateContact({ ...valid, email: 'not-an-email' }).email);
  assert.ok(validateContact({ ...valid, name: 'x'.repeat(101) }).name);
  assert.ok(validateContact({ ...valid, message: 'x'.repeat(5001) }).message);
  assert.deepEqual(validateContact(valid), {});
});

test('submissions use the API and trim visitor data', async () => {
  let request;
  const result = await sendContact({ ...valid, name: ' Alex Smith ' }, async (url, options) => {
    request = { url, ...options };
    return { ok: true, status: 200, json: async () => ({ saved: true, emailSent: true }) };
  });
  assert.equal(request.url, '/api/contact');
  assert.equal(request.method, 'POST');
  assert.equal(JSON.parse(request.body).name, 'Alex Smith');
  assert.equal(result.kind, 'success');
});

test('stored messages without email delivery have a pending status', async () => {
  const result = await sendContact(valid, async () => ({
    ok: true, status: 202, json: async () => ({ saved: true, emailSent: false }),
  }));
  assert.equal(result.kind, 'pending');
  assert.match(result.text, /could not be confirmed/);
});

test('rate limits, storage failures and malformed responses never report success', async () => {
  await assert.rejects(() => sendContact(valid, async () => ({
    ok: false, status: 429, json: async () => null,
  })), /Too many messages/);
  await assert.rejects(() => sendContact(valid, async () => ({
    ok: false, status: 503, json: async () => ({ saved: false, emailSent: false }),
  })), /could not be submitted/);
  await assert.rejects(() => sendContact(valid, async () => ({
    ok: true, status: 200, json: async () => { throw new Error('HTML response'); },
  })), /could not be submitted/);
});

test('a disconnected API rejects the submission', async () => {
  await assert.rejects(() => sendContact(valid, async () => {
    throw new TypeError('Network unavailable');
  }), /Network unavailable/);
});

test('control characters in names and subjects are rejected consistently', () => {
  assert.ok(validateContact({ ...valid, name: 'Alex\tSmith' }).name);
  assert.ok(validateContact({ ...valid, subject: 'Hello\u007fAakash' }).subject);
});

test('truthy strings and contradictory delivery statuses never report success', async () => {
  for (const data of [
    { saved: 'false', emailSent: 'false' },
    { saved: true, emailSent: 'true' },
    { saved: true, emailSent: false },
  ]) {
    await assert.rejects(() => sendContact(valid, async () => ({ status: 200, json: async () => data })), /could not be submitted/);
  }
});

test('server validation errors preserve field details', async () => {
  await assert.rejects(() => sendContact(valid, async () => ({
    status: 400, json: async () => ({ errors: { subject: ['Please change your subject.'] } }),
  })), error => error.fieldErrors.subject === 'Please change your subject.');
});
