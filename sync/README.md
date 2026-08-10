# db-atdc 동기화 데몬 (서버PC 전용)

신규 법인(`1700`) 및 캡스 그룹(`09`) 전용 동기화 워커입니다.
AWS MySQL(`whr`)에서 데이터를 읽어와 Supabase의 `db_*` 테이블에 적재합니다.

## 설치 및 설정

```bash
cd sync
npm install
# 필요 시 .env 파일 수정 (기본값 기입 완료)
```

## 실행

```bash
# 통합 주기적 동기화
npm start

# 개별 동기화 테스트
npm run sync:caps
npm run sync:emp
npm run sync:leaves
```

## PM2 등록 예시

```bash
pm2 start index.js --name db-atdc-sync
pm2 save
```
