import test from 'node:test';
import assert from 'node:assert/strict';
import { instagramUrl, websiteUrl, artistSummary } from '../src/lib/artist-links.ts';

test('Instagram handles and profile links normalize to a safe profile URL', () => {
  for (const value of ['@test.artist', 'test.artist', 'https://instagram.com/test.artist/?igsh=example', 'www.instagram.com/test.artist/'])
    assert.equal(instagramUrl(value), 'https://www.instagram.com/test.artist/');
});
test('Invalid or unrelated Instagram URLs are rejected', () => {
  for (const value of ['', 'https://evil.example/test', 'javascript:alert(1)', 'https://instagram.com@evil.example/test', 'https://instagram.com/p/photo/', 'a'.repeat(31)])
    assert.equal(instagramUrl(value), null);
});
test('Public website links permit only normal web URLs', () => {
  assert.equal(websiteUrl('https://example.com/path'), 'https://example.com/path');
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@example.com']) assert.equal(websiteUrl(value), null);
});
test('Card summary prefers bio, falls back to statement and limits Unicode text', () => {
  assert.equal(artistSummary({ short_bio: ' Bio ', artist_statement: 'Statement' }), 'Bio');
  assert.equal(artistSummary({ short_bio: ' ', artist_statement: 'Statement' }), 'Statement');
  assert.equal(artistSummary({ artist_statement: 'ş'.repeat(181) }), 'ş'.repeat(180) + '…');
  assert.equal(artistSummary({ short_bio: '🙂'.repeat(181) }), '🙂'.repeat(180) + '…');
  assert.equal(artistSummary({}), '');
});
