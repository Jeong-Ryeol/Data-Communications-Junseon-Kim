import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React 19 strict rules — useMemo에서 Date.now() / setState in effect는
      // 본 프로젝트에선 의도된 패턴 (실시간 게이지 / 초기 fetch 트리거).
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      // QrModal의 dataURL은 next/image 부적합 (data URL은 최적화 무관).
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
