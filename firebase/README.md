# Firebase 설정

이 앱은 Firebase Authentication의 익명 로그인과 Realtime Database를 사용합니다.

1. Firebase 프로젝트에 웹 앱을 등록하고 `dist/firebase-config.js`에 구성 객체를 넣습니다.
2. Authentication → Sign-in method에서 Anonymous를 사용 설정합니다.
3. Realtime Database를 만든 뒤 `database.rules.json`의 규칙을 게시합니다.
4. Authentication → Settings → Authorized domains에 배포 도메인을 추가합니다.

보안 규칙은 교사 익명 UID만 수업 전체와 수업 제어를 읽고 바꾸며, 학생 UID는 공유 진행 정보와 자신의 모둠 자료만 읽고 쓰도록 제한합니다. 수업 코드에는 개인정보를 입력하지 않습니다.
