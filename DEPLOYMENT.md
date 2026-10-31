# 배포 준비 안내

## 배포 구조

```text
참가자 브라우저
  ├─ React 정적 페이지 → GitHub Pages
  └─ 설문 API 요청 → Render의 Spring Boot
                              └─ Supabase PostgreSQL
```

GitHub Actions는 React 화면을 GitHub Pages에 배포하고, Render는 Dockerfile을 이용해 Spring Boot API를 실행해. 응답 데이터는 Supabase PostgreSQL에 저장해. DB 비밀번호는 Render 서버 설정에만 넣고 프론트 코드나 GitHub Actions 변수에는 넣지 않아.

## 요금과 사용 조건

- 추천 서버: Render `1c-2g`(1 vCPU, 2GB RAM), 월 표시 가격 $25. 유료 웹 서비스는 초 단위로 비용이 계산되므로 24시간 실행은 약 $0.82~$0.83이야. 세금과 네트워크 사용량에 따라 실제 청구액은 달라질 수 있어.
- 저가 서버: Render `0.5c-512mb`는 월 $7, 24시간 약 $0.23이지만 Java Spring 메모리가 빠듯할 수 있어. 안정성을 위해 이번 배포 준비는 2GB 서버를 기준으로 해.
- Render Free 서버는 15분 동안 요청이 없으면 잠들고 다시 켜질 때 약 1분 걸릴 수 있어. 실험 당일 응답을 기다리지 않도록 유료 서버를 권장해.
- Supabase Free는 DB 500MB까지 무료고, 7일 동안 활동이 적으면 일시정지될 수 있어. 응답 수집 후 DB를 내려받아 보관해.
- GitHub Pages는 정적 프론트 배포에 사용해.

## 배포 순서

### 1. Supabase PostgreSQL 준비

1. Supabase에서 프로젝트를 만들고 지역은 서울(`Northeast Asia (Seoul)`)로 선택해.
2. 프로젝트의 연결 정보에서 Session pooler 정보를 확인해.
3. JDBC URL, 사용자명, DB 비밀번호를 Render 환경변수에 입력할 수 있게 준비해.

### 2. Render에 백엔드 연결

1. Render 계정을 만들고 GitHub 계정을 연결해.
2. Dashboard에서 **New → Web Service**를 선택하고 이 GitHub 저장소를 연결해.
3. 런타임을 **Docker**로 설정하고 Dockerfile 경로를 `backend/Dockerfile`로 지정해. Root Directory를 `/backend`로 지정했다면 Dockerfile 경로는 `Dockerfile`이야.
4. Compute Plan은 `1c-2g`(1 CPU, 2GB RAM)를 선택해.
5. 다음 서비스 변수를 등록해.

| 변수 | 값 |
| --- | --- |
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `DB_URL` | `jdbc:postgresql://<Supabase-host>:<port>/postgres?sslmode=require` |
| `DB_USERNAME` | Supabase가 제공한 DB 사용자명 |
| `DB_PASSWORD` | Supabase DB 비밀번호 |
| `JPA_DDL_AUTO` | `update` |
| `DB_POOL_SIZE` | `5` |
| `CORS_ALLOWED_ORIGINS` | `https://mookmook2.github.io` |

실제 Supabase 연결 정보의 host, port, 사용자명을 사용해. 비밀번호와 DB URL은 프론트엔드 환경변수에 넣지 마. Render가 실행 포트 `PORT`를 제공하고 Dockerfile이 그 포트를 사용해.

6. 서비스가 정상 실행되면 Render가 제공하는 HTTPS 도메인을 확인해. 이 주소가 프론트에서 호출할 API 주소야.

### 3. GitHub Pages와 API 주소 연결

GitHub 저장소에서 **Settings → Secrets and variables → Actions → Variables**로 이동해 다음 변수를 등록해.

| 변수 | 값 |
| --- | --- |
| `VITE_API_BASE_URL` | Render에서 생성한 `https://...` 도메인 |

GitHub Pages 배포 원본은 **GitHub Actions**로 설정해. `main` 브랜치에 배포 변경을 반영하면 기존 워크플로가 프론트를 빌드하고 Pages에 배포해. 워크플로는 API 주소가 없거나 HTTPS가 아니면 배포를 중단해.

### 4. 실험 당일 준비와 종료

실험 전 Render 도메인에서 API가 응답하는지 확인하고, 프론트에서 A방·B방 제출 후 Supabase의 `experiment_sessions`, `room_surveys`, `survey_answers`에 저장됐는지 확인해. 유료 Render 서버는 요청이 없어도 종료되지 않아.

실험 종료 후 결과를 Supabase에서 CSV 또는 SQL로 내려받아 보관해. 사용하지 않을 때 Render 서비스를 중지해 비용이 더 쌓이지 않게 해. 데이터베이스는 수집 결과 백업을 확인한 뒤 정리해.

## 관련 파일

- `backend/Dockerfile`: Java 21 Spring Boot 컨테이너 빌드와 실행
- `backend/.dockerignore`: 컨테이너 빌드에 필요 없는 파일 제외
- `backend/.env.example`: 로컬 환경변수 이름 예시. 실제 비밀번호는 저장소에 올리지 않아.
- `frontend/.env.example`: 로컬에서 쓸 API 주소 예시
- `.github/workflows/deploy.yml`: GitHub Pages 자동 배포 및 API 주소 검사
