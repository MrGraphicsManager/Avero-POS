# Avero Auth Testing Playbook

Custom email/password JWT auth on FastAPI + MongoDB. Tokens via httpOnly cookies + Bearer.

## Admin
- Email: peanplays.2006@gmail.com / Password: Avero@2026 / role admin

## API smoke
```
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"peanplays.2006@gmail.com","password":"Avero@2026"}'
curl -b cookies.txt http://localhost:8001/api/auth/me
```

## Password reset
Set FRONTEND_URL="http://localhost:3000" in backend/.env, restart backend to log reset link locally. Restore https origin after.
- register -> forgot-password (registered vs unregistered must be byte-identical 200) -> reset-password.

## Data isolation
Business A must never read Business B data. All business endpoints scope by business_id via require_business dependency.
