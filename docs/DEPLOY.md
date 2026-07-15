# DEPLOY.md — VPS 배포 가이드 (Docker Compose)

대상 환경: Hostinger VPS (Ubuntu, RAM 8GB, 디스크 100GB), Docker + HTTPS
리버스 프록시. 현재 구성은 **단일 소유자용 SQLite 앱**이다.

## 성능 기대치

VPS에는 GPU가 없어서 Ollama를 CPU로 추론한다. Mac(Apple Silicon)에서 6분 걸리던
분석이 VPS에서는 20분~1시간까지 걸릴 수 있다. 너무 느리면 `.env`의
`OLLAMA_MODEL=qwen3:4b`로 낮추거나, Mac에서 분석하고 VPS는 조회용으로 사용한다.

qwen3:8b 추론 시 메모리를 약 6GB 사용하므로 8GB VPS에는 스왑 4GB를 권장한다.

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 1. 코드와 운영 환경 변수 준비

```bash
git clone git@github.com:<계정>/ijik-os.git
cd ijik-os
cp .env.local.example .env
chmod 600 .env

# 아래 두 명령의 출력은 서로 다른 값으로 .env에 넣는다.
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 32   # OWNER_SETUP_TOKEN
```

`.env`에서 다음 값을 반드시 바꾼다.

| 변수 | 용도와 규칙 |
|---|---|
| `BETTER_AUTH_SECRET` | 세션 서명·암호화 비밀값. 새 무작위 값을 사용하고 운영 중 임의로 바꾸지 않는다. 변경하면 기존 세션이 모두 무효화된다. |
| `BETTER_AUTH_URL` | 브라우저가 접속할 정확한 HTTPS origin. 예: `https://ijik.example.com` |
| `OWNER_EMAIL` | 최초이자 유일한 소유자 로그인 이메일. 이메일 자체는 비밀값이 아니다. |
| `OWNER_SETUP_TOKEN` | `/setup`에서 한 번 쓰는 초기 설정 코드. 최소 24자이며 `openssl rand -base64 32` 출력을 권장한다. |
| `OLLAMA_MODEL` | 기본 `qwen3:8b`. VPS가 너무 느릴 때만 작은 모델을 검토한다. |
| `ANTHROPIC_API_KEY` | 선택값. 설정하면 Ollama 대신 Claude를 사용한다. |

실제 값이 든 `.env`는 커밋하거나 메신저에 붙여넣지 않는다. 서버 외부에도 암호화된
비밀 저장소에만 백업한다. `docker compose config`가 필수 인증 변수를 검사하므로, 기동
전에 오류 없이 렌더링되는지 확인한다.

```bash
docker compose config >/dev/null
```

## 2. 첫 빌드와 기동

```bash
docker compose up -d --build
docker compose exec ollama ollama pull qwen3:8b
docker compose logs --tail=200 app
curl -i http://127.0.0.1:3400/api/auth/get-session
```

마지막 요청은 로그인 전이므로 정상적인 빈 세션 응답을 반환한다. 앱 컨테이너는 기동할
때 `drizzle/`에 커밋된 SQLite 마이그레이션을 자동 적용한다. 운영 DB에
`drizzle-kit push`를 실행하지 않는다.

- 앱은 `127.0.0.1:3400`에만 바인딩된다. `3400:3000`처럼 외부에 직접 열지 않는다.
- Ollama 포트는 Compose 내부 네트워크에만 존재한다.
- SQLite와 모델은 각각 `app-data`, `ollama-models` 볼륨에 보존된다.

## 3. HTTPS 리버스 프록시 + Basic Auth

경험 뱅크에는 민감한 개인 데이터가 들어간다. **앱 로그인을 실제로 확인하기 전까지
Basic Auth를 제거하지 않는다.** 로그인 확인 뒤에도 개인 배포의 추가 방어층으로
유지하는 편을 권장한다.

### Caddy

```bash
docker run --rm caddy:2 caddy hash-password --plaintext '별도의-긴-비밀번호'
```

```caddyfile
ijik.example.com {
    basic_auth {
        <사용자명> <위에서 생성한 해시>
    }
    reverse_proxy 127.0.0.1:3400
}
```

### nginx

```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd <사용자명>
```

```nginx
server {
    server_name ijik.example.com;

    location / {
        auth_basic "ijik-os";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://127.0.0.1:3400;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

TLS 인증서는 Caddy의 자동 HTTPS 또는 nginx+Certbot으로 구성한다. HTTP만으로 로그인
쿠키를 전송하면 안 된다.

## 4. 최초 소유자 계정 만들기

1. Basic Auth가 적용된 `https://ijik.example.com/setup`에 접속한다.
2. 이름, 새 로그인 비밀번호(12자 이상), `.env`의 `OWNER_SETUP_TOKEN`을 입력한다.
3. 생성이 끝나면 로그인 화면에서 `OWNER_EMAIL`과 새 비밀번호로 로그인한다.
4. 로그아웃→로그인, 보호 페이지 접근, API의 미인증 401을 확인한다.

공개 회원가입은 비활성화되어 있고 소유자 계정은 하나만 만들 수 있다. 초기 설정이
끝나면 토큰을 비우고 앱 컨테이너만 다시 생성한다.

```bash
# .env에서 OWNER_SETUP_TOKEN= 으로 비운 뒤
docker compose up -d --force-recreate app
```

Basic Auth 자격 증명만 있고 앱 세션 쿠키가 없는 요청은 보호 API에서 401이어야 한다.
이 확인이 끝나기 전에는 Basic Auth를 절대 제거하지 않는다. 확인 뒤에도 별도 비밀번호를
쓰는 Basic Auth를 유지하면 앱 인증 결함이나 잘못된 배포에 대한 방어층이 된다.

## 5. 스키마 변경 규칙

스키마 변경은 로컬에서 만들고 검증한 SQL만 배포한다.

```bash
# schema.ts 수정 후
npm run db:generate
git diff -- drizzle

# 폐기 가능한 로컬 DB가 아니라면 먼저 백업
npm run db:migrate
npm test
npm run lint
npm run build
```

- `db:generate`는 `drizzle-kit generate`다. `db:migrate`는 앱과 같은 migrator를 실행해
  초기 버전의 `db:push` DB를 안전하게 baseline한 뒤 커밋된 변경만 적용한다.
- 생성된 SQL과 메타 파일을 함께 커밋한다.
- 컬럼 삭제·이름 변경·NOT NULL 추가는 기존 데이터 이관 SQL과 복구 절차를 검토한다.
- `db:push`는 폐기 가능한 로컬 실험 DB에만 사용한다.
- 운영에서는 새 앱 기동 시 커밋된 마이그레이션이 자동 적용된다.

## 6. 안전한 운영 업데이트와 백업

업데이트 직전에 실행 중인 DB를 SQLite backup API로 일관되게 복사하고 호스트로 꺼낸다.

```bash
umask 077
install -d -m 700 backups
STAMP=$(date +%Y%m%d-%H%M%S)
docker compose exec -T app node -e "require('better-sqlite3')('/app/data/app.db').backup('/app/data/pre-deploy.db').then(() => console.log('backup ok'))"
docker compose exec -T app node -e "const db=require('better-sqlite3')('/app/data/pre-deploy.db',{readonly:true}); console.log(db.pragma('integrity_check',{simple:true}))"
APP_CONTAINER=$(docker compose ps -q app)
docker cp "${APP_CONTAINER}:/app/data/pre-deploy.db" "./backups/app-${STAMP}.db"
chmod 600 "./backups/app-${STAMP}.db"
```

`integrity_check` 결과가 `ok`인지 확인한 다음에만 업데이트한다.

```bash
git pull --ff-only
docker compose build app
docker compose up -d app
docker compose logs --tail=200 app
curl -i http://127.0.0.1:3400/api/auth/get-session
```

기동 로그에 마이그레이션 오류가 있으면 앱을 중지하고 로그와 실패 DB를 보존한다. 이전
코드를 새 스키마 DB에 바로 연결하지 말고, 코드 버전과 업데이트 직전 백업을 함께
복원한다. 복원 작업 중에는 앱을 정지해 `app.db-wal`/`app.db-shm`과 본 DB가 동시에
변경되지 않도록 한다.

정기 백업도 같은 SQLite backup API를 사용해 매일 호스트 또는 외부 암호화 저장소로
복사한다. 백업 파일에는 경험·공고·로그인 데이터가 모두 들어 있으므로 운영 DB와 같은
수준으로 보호하고, 실제 복원 연습을 주기적으로 한다.

## 7. 운영 점검표

- `.env` 권한이 600이고 Git·Docker 빌드 컨텍스트 대상이 아닌가
- `backups/` 디렉터리는 700, 백업 DB는 600이며 Git·Docker 대상이 아닌가
- `BETTER_AUTH_URL`이 실제 HTTPS 주소와 정확히 같은가
- `BETTER_AUTH_SECRET`을 안정적으로 보관하고 있는가
- 최초 설정 후 `OWNER_SETUP_TOKEN`을 비웠는가
- 앱 포트는 `127.0.0.1:3400`, Ollama는 외부 미노출 상태인가
- Basic Auth와 앱 로그인이 모두 동작하는가
- 보호 API가 앱 세션 없이 401을 반환하는가
- 최근 백업의 `PRAGMA integrity_check`와 복원 연습이 통과했는가

## 8. SQLite와 향후 SaaS 전환 경계

현재 Better Auth 계정은 SQLite 데이터 전체를 여는 **단일 소유자 접근 제어**다. 경험
카드·공고·초안에는 아직 `user_id`가 없으므로 두 번째 계정을 추가하거나 타인에게
서비스를 열면 데이터가 섞인다.

개인 실사용 동안은 SQLite를 유지한다. 타인에게 서비스를 열거나 자동 수집으로 쓰기량이
커지는 시점에만 Postgres로 전환하고, 인증 사용자와 전 테이블의 `user_id`, 소유권 검사,
기존 데이터 이관을 한 작업으로 도입한다. 인증이 생겼다는 이유만으로 현재 DB를 곧바로
멀티테넌트로 간주하지 않는다.

Mac과 VPS의 SQLite는 서로 다른 DB이며 자동 동기화하지 않는다. 이관이 필요하면 앱을
정지하고 SQLite backup API로 만든 파일을 명시적으로 옮긴다.
