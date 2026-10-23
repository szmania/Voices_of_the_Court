import { isSafeExternalUrl } from '../../src/shared/externalUrl';

describe('isSafeExternalUrl', () => {
    it.each([
        'https://docs.voicesofthecourt.app',
        'https://steamcommunity.com/sharedfiles/filedetails/?id=3654567139',
        'http://localhost:3000/path',
        'mailto:support@voicesofthecourt.app',
    ])('allows %s', (url) => {
        expect(isSafeExternalUrl(url)).toBe(true);
    });

    it.each([
        'file:///C:/Windows/System32/drivers/etc/hosts',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'steam://run/1158310',
        'ftp://example.com/file',
        'not a url',
        '',
    ])('rejects %s', (url) => {
        expect(isSafeExternalUrl(url)).toBe(false);
    });

    it('rejects non-string values', () => {
        expect(isSafeExternalUrl(null)).toBe(false);
        expect(isSafeExternalUrl(undefined)).toBe(false);
        expect(isSafeExternalUrl(42)).toBe(false);
        expect(isSafeExternalUrl({ href: 'https://example.com' })).toBe(false);
    });
});
