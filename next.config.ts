import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 배포용 — 실행에 필요한 파일만 .next/standalone으로 추림
  output: "standalone",
};

export default nextConfig;
