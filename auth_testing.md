# Sign in with Apple — Testing (playbook)
Button flow requires a real Apple ID on an iOS device (manual). Backend routes testable with seeded sessions.
1. Seed a test user + session in MongoDB.
2. Hit /api/auth/me with Bearer token — expect user data.
3. Decode a real identity token — confirm `aud` matches an entry in APPLE_AUDIENCES (com.emergent.cardtableorient.b0nhgs or host.exp.Exponent). Wrong aud must 401.
Automated negative tests: backend/tests/test_apple_auth.py (garbage token, HS256 forged, RS256 wrong key, empty body).
