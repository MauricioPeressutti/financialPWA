# Puesta en marcha — todo en free tier

Necesitás 3 cuentas gratis: **Neon** (base de datos), **Firebase** (login), **Vercel** (hosting).
Ninguna pide tarjeta.

---

## 1. Base de datos — Neon

1. Entrá a https://neon.tech y creá cuenta (con tu Google).
2. **Create project** → nombre `finanzas`, región `AWS · São Paulo` (o la más cercana).
3. En el dashboard, **Connection string** → copiá la opción **Pooled connection**.
4. Pegala en `.env` como `DATABASE_URL`.

```
DATABASE_URL="postgresql://...-pooler.sa-east-1.aws.neon.tech/finanzas?sslmode=require"
```

5. Creá las tablas:

```bash
npm run db:push
```

---

## 2. Login — Firebase

1. https://console.firebase.google.com → **Agregar proyecto**.
   - Podés elegir el proyecto de Google Cloud que ya creaste (`Financial App`) o uno nuevo.
   - Google Analytics: no hace falta.
2. **Authentication** (menú izquierdo) → **Comenzar** → pestaña **Sign-in method**
   → habilitá **Google** → poné un email de soporte → Guardar.
3. **Authentication → Settings → Authorized domains**: agregá `localhost` (ya suele estar)
   y después el dominio de Vercel (`tu-app.vercel.app`).
4. Config del cliente web: ⚙️ **Configuración del proyecto** → sección **Tus apps**
   → ícono `</>` (Web) → registrá la app → copiá los valores de `firebaseConfig`:

```
NEXT_PUBLIC_FIREBASE_API_KEY="AIza..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="financial-app.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="financial-app"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123...:web:abc..."
```

5. Credencial del servidor (Admin SDK): **Configuración del proyecto → Cuentas de servicio**
   → **Generar nueva clave privada** → descarga un JSON. De ese JSON:

```
FIREBASE_PROJECT_ID="financial-app"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxx@financial-app.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
```

> La private key va entre comillas, con los `\n` tal cual aparecen en el JSON.

---

## 3. Probar local

```bash
cp .env.example .env   # completá todo lo de arriba
# además, para local:
#   NEXT_PUBLIC_APP_URL="http://localhost:3000"
npm install
npm run dev
```

Abrí http://localhost:3000 → te manda a `/sign-in` → "Entrar con Google".
La primera vez te crea el usuario, un equipo "Casa" y categorías por defecto.

---

## 4. Deploy — Vercel

1. Subí el repo a GitHub.
2. https://vercel.com → **Add New → Project** → importá el repo.
3. En **Environment Variables** pegá TODAS las de `.env`
   (cambiá `NEXT_PUBLIC_APP_URL` por `https://tu-app.vercel.app`).
4. Deploy.
5. Volvé a Firebase → **Authorized domains** → agregá `tu-app.vercel.app`.
6. `npm run db:push` ya dejó las tablas creadas en Neon (la misma DB sirve para prod).

### Redeploys

Cada `git push` a `main` redeploya solo.

---

## Invitar a tu pareja

Dentro de la app → **Equipo → Generar link de invitación** → mandале el link.
Ella entra con su Google y queda como miembro del equipo.
