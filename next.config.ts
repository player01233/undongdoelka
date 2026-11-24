import type { NextConfig } from "next";

// 보안 응답 헤더. 나중에 실수로 스크립트가 끼어들 틈이 생겨도 피해를 줄이는 두 번째 방어선이다.
// 이 프로젝트는 cacheComponents를 쓰므로 요청마다 값이 바뀌는 nonce 방식 대신, 고정 값 방식의 CSP를 쓴다.
// (Next.js 문서 "Content Security Policy > Without Nonces")
// 개발 서버(npm run dev)는 React가 eval을 쓰므로 개발 중에만 'unsafe-eval'을 허용한다.
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`, // 개발 서버의 자동 새로고침 연결(ws)만 개발 중에 허용
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'", // 다른 사이트가 이 앱을 액자(iframe)처럼 끼워 넣지 못하게 한다.
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
