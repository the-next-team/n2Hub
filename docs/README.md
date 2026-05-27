# n2Hub 프로젝트 문서

이 폴더에는 n2Hub 플랫폼의 설계 및 기획 문서가 보관됩니다.

## 문서 목록

| 파일명 | 설명 | 버전 | 최종 수정 |
|--------|------|------|-----------|
| [n2Hub_IA정의서_v1.0.docx](./n2Hub_IA정의서_v1.0.docx) | Information Architecture 정의서 | v1.0 | 2026-05-27 |

## 문서 재생성

IA 정의서는 스크립트로 자동 생성됩니다.

```bash
# 프로젝트 루트에서 실행
NODE_PATH="C:/Users/simba/AppData/Roaming/npm/node_modules" node scripts/gen_ia.cjs
```

## 폴더 구조

```
docs/
├── README.md                  ← 이 파일
└── n2Hub_IA정의서_v1.0.docx   ← IA 정의서
```
