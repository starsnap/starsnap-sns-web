# StarSnap Web

StarSnap의 일반 사용자용 웹 클라이언트다. 회원 인증, 스냅 피드·상세·업로드, 스타 탐색, 친구 관리, 프로필, 실시간 채팅을 제공하며 메인 백엔드의 REST API와 WebSocket에 연결한다.

## 주요 기능

- Google OAuth와 쿠키 기반 로그인·세션 갱신
- 스냅 피드, 상세, 좋아요, 저장, 댓글, 신고
- 사진·영상 presigned URL 업로드와 처리 상태 확인
- 스타·스타 그룹·사용자 검색
- 친구 요청·수락·거절·취소·삭제
- 채팅방, 메시지 WebSocket 수신, 전송 제한 안내와 실패 초안 복구
- 반응형 레이아웃, 라이트·다크 테마, 다국어 리소스

## 언어와 기술 스택

버전은 `package.json`의 현재 설정을 기준으로 한다.

| 구분 | 기술 | 설정 버전 |
|---|---|---:|
| 언어 | TypeScript | 5.8.3 |
| UI | React / React DOM | 18.3.1 |
| 빌드 | Vite | 5.4.12 |
| 라우팅 | React Router DOM | 6.27.0 |
| 서버 상태 | TanStack React Query | 4.34.17 |
| HTTP | Axios | 1.7.7 |
| 폼 | React Hook Form / Zod | 7.45.0 / 3.22.4 |
| 스타일 | Tailwind CSS | 4.3.0 |
| E2E 도구 | Cypress | 12.6.0 |

## 시스템 아키텍처

~~~mermaid
flowchart LR
    Browser[React 브라우저 앱] --> Router[React Router]
    Router --> Pages[페이지와 기능 컴포넌트]
    Pages --> Query[React Query / 서비스 계층]
    Query --> Axios[AuthAxios / CustomAxios]
    Axios -->|REST + 쿠키| API[StarSnap 메인 API]
    Pages -->|WebSocket| Chat[메인 API 채팅]
    Pages -->|presigned PUT| S3[S3]
    API --> DB[(PostgreSQL)]
    API --> Redis[(Redis)]
~~~

인증이 필요한 HTTP 요청은 공통 Axios 계층을 통과한다. 채팅은 별도 서비스가 WebSocket 연결·재연결과 서버 거절 프레임을 처리하며, 이미지와 영상은 백엔드에서 발급받은 URL로 S3에 직접 전송한다.

## 프로젝트 구조

~~~text
src/
├─ assets/       # 이미지와 정적 리소스
├─ components/   # 공통 UI와 레이아웃
├─ constant/     # 공통 상수
├─ context/      # 인증 등 전역 상태
├─ hooks/        # 재사용 React hooks
├─ i18n/         # 다국어 리소스
├─ lib/          # Axios 등 기반 모듈
├─ pages/        # 라우트 단위 화면
├─ routes/       # 라우터와 접근 제어
├─ services/     # REST·채팅·업로드 서비스
├─ styles/       # 전역 스타일과 디자인 토큰
└─ utils/        # URL·날짜 등 공통 유틸리티
~~~

## 환경 설정

환경별 `.env`에는 필요한 값만 설정하고 실제 키나 토큰은 README에 기록하지 않는다.

- `VITE_API_BASE_URL`: REST API 기준 URL
- `VITE_WS_BASE_URL`: 채팅 WebSocket 기준 URL
- `VITE_PUBLIC_LOCAL_API_HOST`: 배포 환경 API 호스트 대체값
- `VITE_REPORT_BASE_URL`: 신고 API 기준 URL
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth 클라이언트 ID
- `VITE_S3_INPUT_BUCKET_URL`, `VITE_S3_OUTPUT_BUCKET_URL`: 미디어 표시 기준 URL
- `VITE_DEV_API_TARGET`: Vite 개발 프록시 REST 대상(기본 `https://api.starsnap.kr`)
- `VITE_DEV_WS_TARGET`: Vite 개발 프록시 WebSocket 대상(기본 `wss://api.starsnap.kr`)

실사용 계정으로 개발할 때는 HTTPS/WSS 대상만 사용한다. 격리된 로컬 환경에서
평문 프록시가 꼭 필요하면 위 개발 전용 변수를 명시적으로 설정한다.

## 설치와 실행

~~~bash
npm install
npm run dev
~~~

개발 서버는 Vite가 실행하며 백엔드 연결은 Vite proxy 또는 환경 변수로 결정한다.

## 빌드와 확인

~~~bash
npm run build
npm run preview
npm run design:check
npm run cypress:run
~~~

`npm run build`는 TypeScript 프로젝트 빌드 후 Vite 번들을 생성한다. 현재 `package.json`에는 Jest용 `test` 스크립트가 없으므로 Jest 의존성이 설치돼 있다는 이유만으로 단위 테스트가 자동 실행된다고 가정하면 안 된다.

## 관련 문서

- [회원가입 흐름](README_SIGNUP.md)
- [웹 디자인 시스템](design-system/README.md)
- [공통 디자인 시스템](../../DESIGN_SYSTEM.md)
- [메인 API 명세](../starsnap-sns-server/API_SPEC.md)
- [Main 통합 개요](../README.md)
