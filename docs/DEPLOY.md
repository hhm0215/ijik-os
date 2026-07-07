# DEPLOY.md — VPS 배포 가이드 (Docker Compose)

대상 환경: Hostinger VPS (Ubuntu, RAM 8GB, 디스크 100GB), Docker + 리버스 프록시.

## 성능 기대치 먼저 (중요)

VPS에는 GPU가 없어서 **CPU로 추론**한다. Mac(Apple Silicon)에서 6분 걸리던 분석이
VPS에서는 **20분~1시간**까지 걸릴 수 있다. 앱이 "등록 → 백그라운드 분석 → 자동 갱신"
구조라 등록해두고 다른 일을 하면 되지만, 너무 느리면:

- `.env`에 `OLLAMA_MODEL=qwen3:4b` (더 작은 모델, 품질↓ 속도↑)
- 또는 급한 공고만 Mac에서 분석하고 VPS는 보관/조회용으로

메모리: qwen3:8b 추론 시 약 6GB 사용. OpenClaw 등 다른 서비스와 같이 돌리면
빠듯하므로 **스왑 4GB를 먼저 잡아두는 것을 권장**한다:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 1. 코드 올리기

GitHub 프라이빗 저장소를 만들어 push한 뒤 VPS에서 clone (권장):

```bash
# Mac에서
gh repo create ijik-os --private --source . --push   # 또는 GitHub 웹에서 만들고 git remote add

# VPS에서
git clone git@github.com:<계정>/ijik-os.git && cd ijik-os
```

git을 안 쓰려면 rsync로도 가능: `rsync -av --exclude node_modules --exclude .next --exclude data ./ user@vps:~/ijik-os/`

## 2. 빌드 + 기동

```bash
docker compose up -d --build        # 첫 빌드 몇 분
docker compose exec ollama ollama pull qwen3:8b   # 모델 다운로드 (~5GB, 최초 1회)
curl -s http://127.0.0.1:3400/      # 200이면 정상
```

- 앱은 **127.0.0.1:3400**에만 바인딩되어 있다. 외부 노출은 반드시 리버스 프록시를 통해서만.
- 데이터는 도커 볼륨 `app-data`(SQLite), `ollama-models`(모델)에 저장 — 컨테이너를 지워도 유지된다.

## 3. 리버스 프록시 + 인증 (필수)

경험 뱅크는 민감한 개인 데이터이고 앱에 로그인이 없다. **Basic Auth 없이 공개 도메인에 연결하지 말 것.**

### Caddy 예시 (HTTPS 자동)

```bash
docker run --rm caddy:2 caddy hash-password --plaintext '비밀번호'   # 해시 생성
```

```caddyfile
ijik.example.com {
    basic_auth {
        <사용자명> <위에서 생성한 해시>
    }
    reverse_proxy 127.0.0.1:3400
}
```

### nginx 예시

```bash
sudo apt install apache2-utils && sudo htpasswd -c /etc/nginx/.htpasswd <사용자명>
```

```nginx
server {
    server_name ijik.example.com;
    location / {
        auth_basic "ijik-os";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://127.0.0.1:3400;
        proxy_set_header Host $host;
        proxy_read_timeout 300s;
    }
    # HTTPS는 certbot으로
}
```

이미 OpenClaw용 프록시(nginx/Caddy/Traefik)가 있으면 그 설정에 위 블록만 추가하면 된다.

## 4. 운영

```bash
# 업데이트 (코드 변경 후)
git pull && docker compose up -d --build

# 로그
docker compose logs -f app

# DB 백업 (주기적으로 — cron 등록 권장)
docker compose exec app node -e "require('better-sqlite3')('/app/data/app.db').backup('/app/data/backup.db')"
docker cp $(docker compose ps -q app):/app/data/backup.db ./backup-$(date +%Y%m%d).db

# 스키마 변경 시 (개발 규칙)
# schema.ts 수정 → npx drizzle-kit generate → 마이그레이션 파일 커밋
# (빈 DB는 자동 적용, 기존 DB 마이그레이션 적용은 아직 수동 — IDEAS 참고)
```

## 5. Mac ↔ VPS 병행 사용 시 주의

두 곳의 SQLite는 서로 다른 DB다 (동기화 없음). 실사용 DB는 한 곳으로 정하는 것을
권장. 이관이 필요하면 `data/app.db` 파일을 복사하면 된다 (WAL 파일 포함 주의 —
서버 정지 후 복사).
