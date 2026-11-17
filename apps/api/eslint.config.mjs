import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["prisma/generated/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
);
