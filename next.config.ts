import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 배포용 — 실행에 필요한 파일만 .next/standalone으로 추림
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/setup",
        destination: "/signup",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
