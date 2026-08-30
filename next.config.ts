import type { NextConfig } from "next";

// Dominio de Firebase Auth (el proyecto de Firebase, no el de la app)
const FIREBASE_AUTH_HOST = "financial-app-a7ce1.firebaseapp.com";

const nextConfig: NextConfig = {
  // unpdf trae un build serverless de pdf.js; que Next no lo bundlee.
  serverExternalPackages: ["unpdf"],

  async headers() {
    return [
      {
        // Permite que el popup de Google (signInWithPopup) se comunique con
        // la ventana principal sin que COOP bloquee window.closed.
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },

  // Proxy inverso de los handlers de Firebase Auth: así el authDomain puede
  // ser el dominio propio de la app y el flujo de redirect queda same-origin
  // (necesario para que ande en la PWA de iOS).
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/__/auth/:path*",
          destination: `https://${FIREBASE_AUTH_HOST}/__/auth/:path*`,
        },
        {
          source: "/__/firebase/:path*",
          destination: `https://${FIREBASE_AUTH_HOST}/__/firebase/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
