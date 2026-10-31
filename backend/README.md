# 객실 공간 정보 실험 백엔드

Java 21, Spring Boot, Spring Web, Spring Data JPA로 구성했어. 개발할 때는 H2 메모리 DB를 쓰고, 배포에서는 Supabase 관리형 PostgreSQL을 사용하도록 프로필을 나눴어. Supabase는 Spring Boot와 PostgreSQL JDBC 연결 절차를 공식 안내하고 있어. 배포 백엔드가 IPv4 환경이면 Supabase의 Session pooler 연결 문자열을 사용해야 해. [Supabase Spring Boot 안내](https://supabase.com/docs/guides/getting-started/quickstarts/spring-boot) · [연결 방식 안내](https://supabase.com/docs/guides/database/connecting-to-postgres)

## 폴더와 파일 역할

- `controller/ExperimentController`: API 주소, 요청 경로 변수와 JSON 요청을 받고 서비스에 전달
- `service/ExperimentService`: 세션 생성, 객실 시작, 응답 저장과 시간 계산을 구현할 위치
- `entity/ExperimentSession`: 참가자 코드와 실험 전체의 생성·완료 시각
- `entity/RoomSurvey`: 방 코드, 확인 방식, 프론트엔드 측정 탐색 시간, 측정 항목별 평균, 설문 제출 시각
- `entity/SurveyAnswer`: 문항 코드와 점수형 또는 문자형 응답 한 개
- `repository/`: Spring Data JPA 저장소. 기본 `save`, `findById` 등을 상속으로 제공
- `dto/`: API 입력·출력 JSON 모양
- `domain/`: `RoomCode`와 `ViewMode`처럼 허용 값을 제한하는 enum
- `src/main/resources/application*.yml`: 공통·개발·배포 DB 설정

## 실행

VS Code에서 `RoomExperimentApplication.java`의 `main` 위에 표시되는 `Run`을 눌러 실행해. 개발 기본값은 H2 메모리 DB라 PostgreSQL 계정을 준비하기 전에도 애플리케이션을 띄울 수 있어. 터미널에서 Maven을 쓸 수 있다면 `mvn spring-boot:run`으로도 실행할 수 있어.

## 테이블 구조를 쉽게 보면

세션은 실험 참가자 한 명의 전체 기록, 객실 설문은 A방 또는 B방 기록, 답변은 설문 안의 문항 하나를 뜻해. 세션 하나에 객실 설문이 여러 개 붙고, 객실 설문 하나에 답변이 여러 개 붙어.

```text
experiment_sessions (실험 1회)
  └── room_surveys (A방 기록, B방 기록)
        └── survey_answers (s1~s5, q1~q5)
```

| 테이블 | 컬럼 | 의미 |
|---|---|---|
| `experiment_sessions` | `id` | 세션 ID, UUID 기본 키 |
| | `participant_code` | 서버가 발급할 익명 참가자 코드, 중복 불가 |
| | `created_at` | 실험 세션 생성 시각 |
| `room_surveys` | `id` | 객실 기록 ID, UUID 기본 키 |
| | `experiment_session_id` | 어느 실험에 속하는지 가리키는 외래 키 |
| | `room_code` | `A` 또는 `B` |
| | `view_mode` | `PHOTO` 또는 `RENDERING` |
| | `exploration_millis` | 브라우저가 객실 창 표시부터 `설문으로` 클릭까지 재서 보낸 시간 |
| | `convenience_score` | UMUX-LITE 2문항(`s1`, `s2`)의 7점 척도 평균 |
| | `choice_confidence_score` | 정보 신뢰도·예약 의향·선택 확신 3문항(`s3`~`s5`)의 7점 척도 평균 |
| | `space_accuracy` | `q1`~`q5`의 정답률, 0~100% |
| | `submitted_at` | 설문 답변을 제출한 시각. 설문 시간 계산에는 쓰지 않음 |
| `survey_answers` | `id` | 답변 행 ID, UUID 기본 키 |
| | `room_survey_id` | 어느 객실 설문에 대한 답인지 가리키는 외래 키 |
| | `question_code` | `s1`~`s5`, `q1`~`q5` 중 문항 코드 |
| | `answer_score` | 척도 문항 답변 숫자 `1`~`7` |
| | `answer_text` | 객실 구조 문항 답변 예: `왼쪽`, `창문`, `B` |

답변은 10개를 한 칸에 뭉쳐 넣지 않고 문항마다 한 행으로 저장해. 한 객실의 응답은 `room_surveys` 한 행과 연결된 `survey_answers` 10행이 돼. `s1`~`s5`는 `answer_score` 숫자 칼럼, `q1`~`q5`는 `answer_text` 문자 칼럼에 저장해. 편의성 평균은 `s1`, `s2`, 선택 확신도 평균은 정보 신뢰도·예약 의향·선택 확신에 해당하는 `s3`~`s5`로 계산하고, `space_accuracy`는 방별 정답표에 따라 `q1`~`q5`의 정답률을 백분율로 계산해.

브라우저는 객실 창이 표시될 때 `performance.now()`로 타이머를 시작하고, 안내 모달에서 `설문으로`를 누를 때 멈춰. `돌아가기`를 눌러 객실로 돌아오면 타이머를 계속해. 브라우저가 계산한 `exploration_millis`를 완료 요청에 담아 서버에 보내고, 서버는 그 값을 저장해. 설문을 천천히 작성해도 탐색 시간에는 포함되지 않고, `submitted_at`은 답변 저장 시각만 남겨.

`uk_session_room` 제약은 같은 세션에 A방이나 B방 기록이 두 번 생기는 걸 막고, `uk_room_question` 제약은 같은 방 설문에 같은 문항 답변이 중복 저장되는 걸 막아.

## API 초안

| 동작 | 요청 | 역할 |
|---|---|---|
| 실험 시작 | `POST /api/experiments` | 세션과 A방 기록 생성 |
| 객실 시작 | `POST /api/experiments/{experimentId}/rooms/{roomCode}/start` | `viewMode` 기록 |
| 설문으로 이동 | `POST /api/experiments/{experimentId}/rooms/{roomCode}/exploration-complete` | 모달에서 `설문으로`를 눌렀을 때 브라우저 측정시간 저장 |
| 설문 제출 | `POST /api/experiments/{experimentId}/rooms/{roomCode}/submit` | 10개 답변, 항목별 평균, 공간 이해 정답률과 제출 시각 저장 |

`roomCode`는 `A`, `B`; `viewMode`는 `PHOTO`, `RENDERING` 값으로 제한했어. 객실 시작 요청은 `{"viewMode":"RENDERING"}` 형태고, 탐색 완료 요청은 `{"explorationMillis":65734}` 형태야. 설문 제출 JSON은 다음 형태야.

```json
{
  "answers": {
    "s1": "5",
    "s2": "6",
    "s3": "5",
    "s4": "6",
    "s5": "5",
    "q1": "창문"
  }
}
```

Controller는 요청을 받아 Service를 호출하고 결과 DTO를 JSON으로 반환해. Service는 실험 세션과 객실 기록 생성, 탐색 시간 저장, 설문 답변 저장을 담당해. 프론트 타이머의 `explorationMillis`를 탐색 완료 API로 보내고, 설문 제출 API는 `s1`~`s5`, `q1`~`q5` 응답과 편의성·선택 확신도 평균, 공간 이해 정답률을 저장해. `돌아가기`를 누르면 탐색 완료 API를 호출하지 않고 타이머를 계속 잰다.

## DB 설정

- 개발 기본 프로필은 H2 메모리 DB라 PostgreSQL 서버 없이 앱을 실행할 수 있어. 앱을 끄면 H2 데이터가 사라져.
- 배포 환경 변수 `SPRING_PROFILES_ACTIVE=prod`로 PostgreSQL 프로필을 선택해.
- `DB_URL`에는 Supabase 대시보드의 Connect에서 받은 Session pooler 호스트와 포트를 JDBC 형식으로 넣어. 예: `jdbc:postgresql://<pooler-host>:5432/postgres?sslmode=require`
- `DB_USERNAME`은 pooler가 보여주는 사용자명, `DB_PASSWORD`는 프로젝트 DB 비밀번호야.
- `JPA_DDL_AUTO` 기본값 `update`는 학습·초기 확인용으로 테이블을 자동 맞춰. 실제 데이터 운영 단계에서는 스키마 변경 이력을 별도로 관리하고 `validate`로 바꾸는 게 안전해.

환경 변수 예시는 `.env.example`을 참고해. `.env`에는 실제 비밀번호를 넣고 저장소에 올리지 마.

## 어노테이션과 핵심 타입

- `@SpringBootApplication`: 자동 설정, 컴포넌트 검색, 애플리케이션 시작 설정을 묶어.
- `@RestController`: 반환 객체를 JSON 응답으로 내보내는 컨트롤러야.
- `@RequestMapping`, `@PostMapping`: 클래스와 메소드의 HTTP 경로를 정해.
- `@PathVariable`: URL의 `{experimentId}`, `{roomCode}` 값을 메소드 인자로 받아.
- `@RequestBody`: 요청 JSON을 DTO로 변환해.
- `@Valid`, `@NotEmpty`, `@NotBlank`: 제출 답변 맵이 비어 있지 않은지와 키·값을 검사해.
- `@Service`: 서비스 클래스를 Spring이 생성·관리하도록 등록해.
- `@Transactional`: 메소드 안의 여러 DB 작업을 한 트랜잭션으로 묶어. 런타임 오류가 나면 함께 롤백돼.
- `@Entity`, `@Table`: 클래스를 DB 테이블에 매핑해.
- `@Id`, `@GeneratedValue`: 기본 키와 자동 UUID 생성을 지정해.
- `@ManyToOne`, `@OneToMany`, `@JoinColumn`: 세션-객실-응답 사이의 DB 관계를 표현해.
- `@Enumerated(EnumType.STRING)`: enum 이름을 문자열로 저장해 숫자 순서 변경으로 값이 바뀌는 문제를 피하게 해.
- `JpaRepository<Entity, UUID>`: 기본 CRUD 메소드와 메소드 이름 기반 조회를 제공해.
- `UUID`: 세션과 레코드의 식별자 타입이야. DB 컬럼명은 Spring의 기본 네이밍 규칙에 따라 `participant_code`처럼 snake_case로 변환돼.
