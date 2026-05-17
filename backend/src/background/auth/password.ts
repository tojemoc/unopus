import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const SCRYPT_KEYLEN = 64

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex')
	const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
	return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
	const parts = stored.split(':')
	if (parts.length !== 3 || parts[0] !== 'scrypt') {
		return false
	}
	const [, salt, expectedHex] = parts
	const expected = Buffer.from(expectedHex, 'hex')
	const actual = scryptSync(password, salt, SCRYPT_KEYLEN)
	if (expected.length !== actual.length) {
		return false
	}
	return timingSafeEqual(expected, actual)
}
