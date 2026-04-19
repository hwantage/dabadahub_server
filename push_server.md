# 실시간 푸시 및 서버 서빙 팝업을 위한 Express 서버 구현 가이드

이 문서는 다바다허브 익스텐션의 실시간 푸시 및 서버 서빙 팝업 기능을 지원하기 위한 Express 서버측 구현 가이드입니다. 최근 업데이트를 통해 푸시 메시지의 **데이터베이스 저장, 타입별 템플릿 지원, 그리고 알림 목록 UI** 기능이 추가되었습니다.

## 1. 개요 (Overview)
익스텐션의 **Offscreen API**를 통해 서버와 **SSE(Server-Sent Events)** 연결을 유지하며, 서버에서 특정 IP를 대상으로 푸시를 발송하면 익스텐션이 서버의 특정 URL을 별도 팝업창으로 띄우는 구조입니다. 발송된 푸시 메시지는 데이터베이스에 저장되어 이전 알림 목록 및 읽음 상태 관리가 가능합니다.

---

## 2. 데이터베이스 스키마 설계 (DDL)
푸시 메시지 이력을 영구적으로 관리하기 위해 PostgreSQL(또는 MySQL)에 아래와 같은 테이블을 생성합니다. 서버 구동 시 모델 초기화 단계에서 자동으로 생성되도록 구현되어 있습니다.

```sql
CREATE TABLE IF NOT EXISTS dabada_push_messages (
    id SERIAL PRIMARY KEY,
    target_ip VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'default',
    title VARCHAR(255),
    message TEXT,
    action_url VARCHAR(1000),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
- **`type`**: 알림의 종류를 구분하며 (`default`, `hook`, `jenkins`, `mr` 등), 이에 따라 팝업의 템플릿 디자인이 달라집니다.
- **`action_url`**: 사용자가 알림 모달에서 [확인] 버튼을 눌렀을 때 이동할 대상 URL입니다.

---

## 3. 서버 측 구현 (Node.js/Express)

실제 서버는 비즈니스 로직을 `dabadapushService` 등의 서비스 레이어로 분리하여 관리하고 있습니다. 아래는 `server.js`에 정의된 핵심 라우팅 구조입니다.

### 3.1. SSE 연결 및 클라이언트 관리
서버는 익스텐션의 연결을 유지하고, 요청자의 IP를 식별하여 연결 객체를 관리합니다.

```javascript
// [Endpoint] 익스텐션(Offscreen) 연결 엔드포인트
app.get("/api/stream", (req, res) => {
  dabadapushService.handleStream(req, res);
});
```

### 3.2. 푸시 발송 및 상태 관리 API (핵심)
외부 시스템이나 훅(Hook)에서 푸시를 보낼 때 사용하는 메인 API입니다.

#### [POST] /api/send-push
가장 권장되는 표준 푸시 발송 방식입니다. JSON 바디를 사용합니다.

- **URL:** `http://localhost:7500/api/send-push`
- **Method:** `POST`
- **Content-Type:** `application/json`
- **Payload:**
  | 필드명 | 타입 | 필수 | 설명 |
  | :--- | :--- | :---: | :--- |
  | `targetIp` | String | O | 푸시를 수신할 클라이언트의 IP 주소 |
  | `type` | String | X | 알림 타입 (`default`, `hook`, `jenkins`, `mr`) |
  | `title` | String | X | 알림창 제목 |
  | `message` | String | X | 알림 본문 메시지 |
  | `actionUrl` | String | X | 확인 버튼 클릭 시 이동할 URL |

---

## 4. 작동 프로세스 요약

1. **연결**: 익스텐션이 실행되면 서버의 `/api/stream`에 접속하여 IP 기준 SSE 연결을 맺습니다.
2. **트리거**: 훅(notify.sh) 등에서 `POST /api/send-push`를 호출합니다.
3. **전송 및 저장**: 서버는 메시지를 DB에 저장하고, 생성된 `id`와 함께 SSE로 데이터를 전송합니다.
4. **팝업 실행**: 익스텐션이 데이터를 수신하여 `/push-popup?ip=...&newPushId=...` URL을 팝업창으로 띄웁니다.
5. **액션 처리**: 사용자가 [확인]을 누르면 `action_url`로 이동하며, 서버로 `/api/read-push` 요청을 보내 읽음 처리합니다.

---

## 5. 테스트 푸시 발송 방법 (CURL 명령어)

테스트 시 쉘(Shell) 환경에 따라 JSON 파싱 에러가 발생할 수 있으므로 아래 예시를 참고하세요.

### 5.1. POST 방식 테스트 (JSON 사용)
윈도우 CMD나 일부 쉘에서 줄바꿈 문제를 피하기 위해 **한 줄로 작성**하는 것이 안전합니다.

```bash
# 한 줄로 작성된 표준 curl (추천)
curl -X POST http://localhost:7500/api/send-push -H "Content-Type: application/json" -d "{\"targetIp\":\"127.0.0.1\",\"type\":\"hook\",\"title\":\"테스트 알림\",\"message\":\"메시지 내용입니다.\"}"

# jq를 사용하여 안전하게 전송하는 방법 (가독성 좋음)
echo '{"targetIp":"127.0.0.1","type":"jenkins","title":"빌드완료","message":"성공적으로 빌드되었습니다."}' | curl -X POST http://localhost:7500/api/send-push -H "Content-Type: application/json" -d @-
```

### 5.2. GET 방식 테스트 (Query Parameter 사용)
브라우저 주소창이나 간단한 `GET` 호출로 테스트하고 싶을 때 사용합니다.

- **Endpoint:** `/api/test-push`
- **매개변수:** `ip` (대상 IP), `type`, `title`, `msg` (메시지 본문), `actionUrl`

```bash
# 브라우저 주소창 입력 예시
http://localhost:7500/api/test-push?ip=127.0.0.1&type=hook&title=테스트&msg=안녕

# curl 사용 예시
curl "http://localhost:7500/api/test-push?ip=127.0.0.1&type=jenkins&title=Build&msg=Success"
```

---

## 6. 주의 사항
- **파라미터명 주의**: `POST` 요청 시에는 `targetIp`와 `message`를 사용하고, `GET` 요청 시에는 `ip`와 `msg`를 사용합니다 (서버 코드 호환성 때문).
- **네트워크 환경**: 서버의 `port`는 기본적으로 `7500`을 사용하며, 환경 변수 `PORT`로 변경 가능합니다.
- **연결 확인**: 서버 콘솔에 `[SSE Connected] IP: 127.0.0.1` 로그가 찍혀 있는지 확인 후 테스트를 진행하세요.
